import SwiftUI
import WidgetKit

// MARK: - Data

private struct HelmWidgetPayload: Decodable {
  let liveUsers: Double
  let liveUsersText: String?
  let adRevenueText: String?
  let incomingPaymentsText: String?
  let totalRevenueText: String?
  let mrrDelta: Double?
  let mrrDeltaText: String?
  let conversionRate: Double?
  let conversionRateText: String?
  let openAlerts: Double
  let sparkline: [Double]?
  let currency: String?
  let updatedAtIso: String

  let adRevenue: Double?
  let incomingPayments: Double?
  let totalRevenue: Double?

  var totalDisplay: String {
    totalRevenueText ?? legacyMoney(totalRevenue ?? ((adRevenue ?? 0) + (incomingPayments ?? 0)))
  }

  var adDisplay: String { adRevenueText ?? legacyMoney(adRevenue ?? 0) }
  var payDisplay: String { incomingPaymentsText ?? legacyMoney(incomingPayments ?? 0) }
  var liveDisplay: String { liveUsersText ?? String(Int(liveUsers)) }

  var deltaLabel: String {
    if let mrrDeltaText { return mrrDeltaText }
    if let conversionRateText { return conversionRateText }
    guard let mrrDelta else {
      guard let conversionRate else { return "—" }
      return String(format: "%+.0f%%", conversionRate)
    }
    return String(format: "%+.0f%%", mrrDelta)
  }

  var deltaUp: Bool { (mrrDelta ?? conversionRate ?? 0) >= 0 }

  var weekBars: [Double] {
    let fallback = [0.42, 0.58, 0.5, 0.72, 0.65, 0.88, 0.95]
    guard let sparkline, sparkline.count >= 7 else { return fallback }
    return Array(sparkline.prefix(7))
  }

  var totalNumeric: Double {
    totalRevenue ?? ((adRevenue ?? 0) + (incomingPayments ?? 0))
  }

  var compactTotalDisplay: String {
    abbreviateCurrency(totalDisplay, value: totalNumeric)
  }

  private func legacyMoney(_ value: Double) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = currency ?? "TRY"
    formatter.minimumFractionDigits = 2
    formatter.maximumFractionDigits = 2
    return formatter.string(from: NSNumber(value: value)) ?? "—"
  }
}

private struct HelmWidgetEntry: TimelineEntry {
  let date: Date
  let payload: HelmWidgetPayload?
}

private func abbreviateCurrency(_ text: String, value: Double) -> String {
  if text.count <= 11 { return text }
  let code = text.first == "₺" ? "₺" : (text.first == "$" ? "$" : "")
  let abs = abs(value)
  if abs >= 1_000_000 {
    return String(format: "%@%.1fM", code, value / 1_000_000)
  }
  if abs >= 10_000 {
    return String(format: "%@%.0fK", code, value / 1_000)
  }
  if abs >= 1_000 {
    return String(format: "%@%.1fK", code, value / 1_000)
  }
  return text
}

private extension WidgetFamily {
  var isLockScreenAccessory: Bool {
    switch self {
    case .accessoryInline, .accessoryRectangular, .accessoryCircular:
      return true
    default:
      return false
    }
  }
}

// MARK: - Rendering (full-color glass vs iOS tinted / accented)

private enum HelmRenderStyle {
  case glass
  case accented
}

private struct HelmRenderStyleKey: EnvironmentKey {
  static let defaultValue = HelmRenderStyle.glass
}

private extension EnvironmentValues {
  var helmRenderStyle: HelmRenderStyle {
    get { self[HelmRenderStyleKey.self] }
    set { self[HelmRenderStyleKey.self] = newValue }
  }
}

private enum HelmTextRole {
  case primary
  case secondary
  case tertiary

  var glassColor: Color {
    switch self {
    case .primary: G.text
    case .secondary: G.mute
    case .tertiary: G.dim
    }
  }
}

private struct HelmTextStyle: ViewModifier {
  let role: HelmTextRole
  @Environment(\.helmRenderStyle) private var style

  func body(content: Content) -> some View {
    // Tinted home screen: keep readable labels on our dark containerBackground.
    // Reserve widgetAccentable() for hero metrics only (amount, chart, badge).
    content.foregroundStyle(role.glassColor)
  }
}

private extension View {
  func helmText(_ role: HelmTextRole = .primary) -> some View {
    modifier(HelmTextStyle(role: role))
  }
}

// MARK: - Glass tokens

private enum G {
  static let base = Color(red: 12 / 255, green: 12 / 255, blue: 16 / 255)
  static let glass = Color(red: 28 / 255, green: 28 / 255, blue: 34 / 255).opacity(0.72)
  static let text = Color.white
  static let mute = Color.white.opacity(0.55)
  static let dim = Color.white.opacity(0.35)
  static let track = Color.white.opacity(0.1)
  static let up = Color(red: 52 / 255, green: 199 / 255, blue: 89 / 255)
  static let down = Color(red: 255 / 255, green: 69 / 255, blue: 58 / 255)
  static let barTop = Color(red: 255 / 255, green: 107 / 255, blue: 107 / 255)
  static let barMid = Color(red: 197 / 255, green: 108 / 255, blue: 240 / 255)
  static let barBot = Color(red: 72 / 255, green: 52 / 255, blue: 212 / 255)

  static let barGradient = LinearGradient(
    colors: [barTop, barMid, barBot],
    startPoint: .top,
    endPoint: .bottom
  )
}

// MARK: - Provider

private struct HelmWidgetProvider: TimelineProvider {
  private let suiteName = "group.com.canakyuz.helmmobile.shared"
  private let payloadKey = "helm_widget_payload"
  private let payloadFile = "helm_widget_payload.json"

  func placeholder(in context: Context) -> HelmWidgetEntry {
    HelmWidgetEntry(date: Date(), payload: Self.demo)
  }

  func getSnapshot(in context: Context, completion: @escaping (HelmWidgetEntry) -> Void) {
    completion(HelmWidgetEntry(date: Date(), payload: readPayload() ?? Self.demo))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<HelmWidgetEntry>) -> Void) {
    let entry = HelmWidgetEntry(date: Date(), payload: readPayload())
    let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }

  private func readPayload() -> HelmWidgetPayload? {
    if let payload = readFromUserDefaults() { return payload }
    return readFromSharedFile()
  }

  private func readFromUserDefaults() -> HelmWidgetPayload? {
    guard
      let store = UserDefaults(suiteName: suiteName),
      let raw = store.string(forKey: payloadKey),
      let data = raw.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(HelmWidgetPayload.self, from: data)
  }

  private func readFromSharedFile() -> HelmWidgetPayload? {
    guard
      let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: suiteName)
    else { return nil }
    let url = base.appendingPathComponent(payloadFile)
    guard let data = try? Data(contentsOf: url) else { return nil }
    return try? JSONDecoder().decode(HelmWidgetPayload.self, from: data)
  }

  static let demo = HelmWidgetPayload(
    liveUsers: 1240,
    liveUsersText: "1,240",
    adRevenueText: "₺8,420",
    incomingPaymentsText: "₺15,600",
    totalRevenueText: "₺24,020.75",
    mrrDelta: 12,
    mrrDeltaText: "+12%",
    conversionRate: nil,
    conversionRateText: nil,
    openAlerts: 2,
    sparkline: [0.42, 0.58, 0.5, 0.72, 0.65, 0.88, 0.95],
    currency: "TRY",
    updatedAtIso: "",
    adRevenue: 8420,
    incomingPayments: 15600,
    totalRevenue: 24020.75
  )
}

private func splitMoney(_ text: String) -> (main: String, cents: String) {
  let comma = text.lastIndex(of: ",")
  let dot = text.lastIndex(of: ".")

  if let comma, let dot {
    if comma > dot {
      return (String(text[..<comma]), String(text[comma...]))
    }
    return (String(text[..<dot]), String(text[dot...]))
  }

  if let sep = comma ?? dot {
    let suffix = text.index(after: sep)
    let fracLen = text.distance(from: suffix, to: text.endIndex)
    if fracLen > 0, fracLen <= 2 {
      return (String(text[..<sep]), String(text[sep...]))
    }
  }

  return (text, "")
}

// MARK: - Glass chrome

private struct HelmGlassSurface: View {
  var body: some View {
    ZStack {
      G.glass
      LinearGradient(
        colors: [Color.white.opacity(0.14), Color.white.opacity(0.02)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    }
  }
}

private struct HelmGlassBorder: View {
  var radius: CGFloat = 24

  var body: some View {
    RoundedRectangle(cornerRadius: radius, style: .continuous)
      .strokeBorder(
        LinearGradient(
          colors: [Color.white.opacity(0.28), Color.white.opacity(0.06)],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        ),
        lineWidth: 1
      )
  }
}

// MARK: - Atoms

private struct HelmTotalAmount: View {
  let full: String
  let mainPt: CGFloat
  let centsPt: CGFloat

  @Environment(\.helmRenderStyle) private var style
  private var parts: (main: String, cents: String) { splitMoney(full) }

  var body: some View {
    ViewThatFits(in: .horizontal) {
      amountRow(main: mainPt, cents: centsPt)
      amountRow(main: mainPt * 0.88, cents: centsPt * 0.88)
      amountRow(main: mainPt * 0.76, cents: centsPt * 0.76)
      amountRow(main: mainPt * 0.64, cents: centsPt * 0.64)
      amountRow(main: mainPt * 0.52, cents: centsPt * 0.52)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .modifier(HelmAmountAccentModifier())
  }

  private func amountRow(main: CGFloat, cents: CGFloat) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 0) {
      amountPart(parts.main, size: main, baseline: 0)
      if !parts.cents.isEmpty {
        amountPart(parts.cents, size: cents, baseline: main * 0.35)
      }
    }
  }

  @ViewBuilder
  private func amountPart(_ text: String, size: CGFloat, baseline: CGFloat) -> some View {
    let label = Text(text)
      .font(.system(size: size, weight: .bold))
      .lineLimit(1)
      .baselineOffset(baseline)
    if style == .glass {
      label.foregroundStyle(G.text)
    } else {
      label
    }
  }
}

/// Accented mode: tint the whole amount as one accent layer.
private struct HelmAmountAccentModifier: ViewModifier {
  @Environment(\.helmRenderStyle) private var style

  func body(content: Content) -> some View {
    if style == .accented {
      content.widgetAccentable()
    } else {
      content
    }
  }
}

private struct HelmDeltaBadge: View {
  let label: String
  let up: Bool

  @Environment(\.helmRenderStyle) private var style

  var body: some View {
    Group {
      if style == .accented {
        Text(label)
          .font(.system(size: 11, weight: .semibold))
          .widgetAccentable()
      } else {
        Text(label)
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(up ? G.up : G.down)
          .padding(.horizontal, 7)
          .padding(.vertical, 3)
          .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
          .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
              .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
          )
      }
    }
  }
}

private struct HelmWeekChart: View {
  let weights: [Double]
  var barHeight: CGFloat = 36
  var showLetters = true

  @Environment(\.helmRenderStyle) private var style
  private let letters = ["M", "T", "W", "T", "F", "S", "S"]

  var body: some View {
    HStack(alignment: .bottom, spacing: 3) {
      ForEach(0 ..< min(7, weights.count), id: \.self) { i in
        VStack(spacing: 4) {
          ZStack(alignment: .bottom) {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
              .fill(style == .accented ? Color.primary.opacity(0.15) : G.track)
              .frame(height: barHeight)
            chartBar(height: max(4, barHeight * CGFloat(weights[i])))
          }
          .frame(maxWidth: .infinity)

          if showLetters {
            Text(letters[i])
              .font(.system(size: 8, weight: .medium))
              .helmText(.tertiary)
          }
        }
      }
    }
  }

  @ViewBuilder
  private func chartBar(height: CGFloat) -> some View {
    let shape = RoundedRectangle(cornerRadius: 5, style: .continuous)
    if style == .accented {
      shape.fill(Color.primary).frame(height: height).widgetAccentable()
    } else {
      shape.fill(G.barGradient).frame(height: height)
    }
  }
}

private struct HelmGlassTile: View {
  let title: String
  let value: String

  @Environment(\.helmRenderStyle) private var style

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(title)
        .font(.system(size: 9, weight: .medium))
        .helmText(.tertiary)
        .textCase(.uppercase)
      Text(value)
        .font(.system(size: 12, weight: .semibold))
        .helmText(.primary)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
    .padding(.horizontal, style == .glass ? 12 : 4)
    .padding(.vertical, style == .glass ? 10 : 4)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background {
      if style == .glass {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
          .fill(Color.white.opacity(0.06))
          .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
              .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
          )
      }
    }
  }
}

// MARK: - Layouts

private struct HelmGlassCard: View {
  let payload: HelmWidgetPayload
  var compact: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .top) {
        Text("Total Revenue")
          .font(.system(size: compact ? 10 : 11, weight: .medium))
          .helmText(.secondary)
        Spacer(minLength: 4)
        HelmDeltaBadge(label: payload.deltaLabel, up: payload.deltaUp)
      }

      HelmTotalAmount(
        full: payload.totalDisplay,
        mainPt: compact ? 22 : 28,
        centsPt: compact ? 12 : 15
      )
      .padding(.top, 8)

      Text("\(payload.adDisplay) ad · \(payload.payDisplay) pay")
        .font(.system(size: compact ? 10 : 11, weight: .regular))
        .helmText(.secondary)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .padding(.top, 6)

      Spacer(minLength: 4)

      HelmWeekChart(
        weights: payload.weekBars,
        barHeight: compact ? 32 : 44,
        showLetters: true
      )
    }
  }
}

private struct HelmSmallBody: View {
  let p: HelmWidgetPayload

  var body: some View {
    HelmGlassCard(payload: p, compact: true)
      .padding(14)
  }
}

private struct HelmMediumBody: View {
  let p: HelmWidgetPayload

  var body: some View {
    HelmGlassCard(payload: p, compact: false)
      .padding(EdgeInsets(top: 16, leading: 18, bottom: 14, trailing: 18))
  }
}

private struct HelmLargeBody: View {
  let p: HelmWidgetPayload

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .top) {
        Text("Total Revenue")
          .font(.system(size: 11, weight: .medium))
          .helmText(.secondary)
        Spacer(minLength: 4)
        HelmDeltaBadge(label: p.deltaLabel, up: p.deltaUp)
      }

      HelmTotalAmount(full: p.totalDisplay, mainPt: 32, centsPt: 17)
        .padding(.top, 10)

      Text("\(p.adDisplay) ad · \(p.payDisplay) pay")
        .font(.system(size: 11))
        .helmText(.secondary)
        .padding(.top, 6)

      Spacer().frame(height: 14)

      HStack(spacing: 8) {
        HelmGlassTile(title: "Ad", value: p.adDisplay)
        HelmGlassTile(title: "Pay", value: p.payDisplay)
      }

      Spacer().frame(height: 8)

      HStack(spacing: 8) {
        HelmGlassTile(title: "Live", value: p.liveDisplay)
        HelmGlassTile(title: "Alerts", value: "\(Int(p.openAlerts))")
      }

      Spacer(minLength: 8)

      HelmWeekChart(weights: p.weekBars, barHeight: 56)
    }
    .padding(EdgeInsets(top: 16, leading: 18, bottom: 14, trailing: 18))
  }
}

// MARK: - Lock screen

private struct HelmLockInlineBody: View {
  let p: HelmWidgetPayload

  var body: some View {
    Text("helm · \(p.compactTotalDisplay) · \(p.deltaLabel)")
      .font(.system(.body, design: .rounded))
      .widgetAccentable()
  }
}

private struct HelmLockRectBody: View {
  let p: HelmWidgetPayload

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
    HStack(alignment: .firstTextBaseline, spacing: 6) {
      Text("Total Revenue")
        .font(.system(size: 12, weight: .semibold))
        .lineLimit(1)
      Spacer(minLength: 0)
      Text(p.deltaLabel)
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(p.deltaUp ? G.up : G.down)
    }
    Text(p.totalDisplay)
      .font(.system(size: 15, weight: .bold, design: .rounded))
      .lineLimit(1)
      .minimumScaleFactor(0.55)
    Text("\(p.adDisplay) ad · \(p.payDisplay) pay")
      .font(.system(size: 10, weight: .medium))
      .foregroundStyle(.secondary)
      .lineLimit(1)
      .minimumScaleFactor(0.7)
  }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .widgetAccentable()
  }
}

private struct HelmLockCircularBody: View {
  let p: HelmWidgetPayload

  var body: some View {
    let delta = p.mrrDelta ?? p.conversionRate ?? 0
    let gaugeValue = min(100, max(0, 50 + delta))

    Gauge(value: gaugeValue, in: 0...100) {
      Image(systemName: p.currency == "USD" ? "dollarsign.circle.fill" : "turkishlirasign.circle.fill")
    } currentValueLabel: {
      Text(p.compactTotalDisplay)
        .font(.system(size: 11, weight: .bold, design: .rounded))
        .minimumScaleFactor(0.5)
        .lineLimit(1)
    }
    .gaugeStyle(.accessoryCircular)
    .widgetAccentable()
  }
}

private struct HelmLockOfflineBody: View {
  let family: WidgetFamily

  var body: some View {
    switch family {
    case .accessoryInline:
      Text("helm — open app to sync")
    case .accessoryRectangular:
      VStack(alignment: .leading, spacing: 2) {
        Text("helm")
          .font(.system(size: 12, weight: .semibold))
        Text("Open app · sync cockpit")
          .font(.system(size: 10))
          .foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    default:
      Gauge(value: 0, in: 0...1) {
        Image(systemName: "chart.line.uptrend.xyaxis")
      } currentValueLabel: {
        Text("—")
      }
      .gaugeStyle(.accessoryCircular)
    }
  }
}

private struct HelmOfflineBody: View {
  let small: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Total Revenue")
        .font(.system(size: 11, weight: .medium))
        .helmText(.secondary)
      HelmTotalAmount(full: "—", mainPt: small ? 22 : 28, centsPt: small ? 12 : 15)
      Text("Open helm · sync cockpit")
        .font(.system(size: 10, weight: .medium))
        .helmText(.tertiary)
      Spacer(minLength: 0)
    }
    .padding(small ? 14 : 18)
  }
}

// MARK: - Root

private struct HelmSummaryWidgetView: View {
  @Environment(\.widgetFamily) private var family
  @Environment(\.widgetRenderingMode) private var renderingMode
  let entry: HelmWidgetEntry

  private var homeRenderStyle: HelmRenderStyle {
    if #available(iOS 17.0, *) {
      // Tinted / vibrant home screen — glass chrome off, accent on hero metrics only.
      return renderingMode == .fullColor ? .glass : .accented
    }
    return .glass
  }

  @ViewBuilder
  private var homeScreenContent: some View {
    if let p = entry.payload {
      switch family {
      case .systemSmall: HelmSmallBody(p: p)
      case .systemLarge: HelmLargeBody(p: p)
      default: HelmMediumBody(p: p)
      }
    } else {
      HelmOfflineBody(small: family == .systemSmall)
    }
  }

  @ViewBuilder
  private var homeScreenBody: some View {
    ZStack {
      if homeRenderStyle == .glass {
        HelmGlassSurface()
        HelmGlassBorder()
      }
      homeScreenContent
    }
    .environment(\.helmRenderStyle, homeRenderStyle)
  }

  @ViewBuilder
  private var lockScreenBody: some View {
    if let p = entry.payload {
      switch family {
      case .accessoryInline: HelmLockInlineBody(p: p)
      case .accessoryRectangular: HelmLockRectBody(p: p)
      case .accessoryCircular: HelmLockCircularBody(p: p)
      default: EmptyView()
      }
    } else {
      HelmLockOfflineBody(family: family)
    }
  }

  var body: some View {
    if family.isLockScreenAccessory {
      lockScreenBody
    } else {
      homeScreenBody
    }
  }
}

struct HelmSummaryWidget: Widget {
  let kind: String = "HelmSummaryWidget"

  var body: some WidgetConfiguration {
    let config = StaticConfiguration(kind: kind, provider: HelmWidgetProvider()) { entry in
      HelmSummaryWidgetView(entry: entry)
        .helmWidgetBackground()
    }
    .configurationDisplayName("helm")
    .description("Total revenue on home screen and lock screen.")
    .supportedFamilies([
      .systemSmall,
      .systemMedium,
      .systemLarge,
      .accessoryInline,
      .accessoryRectangular,
      .accessoryCircular,
    ])

    if #available(iOS 17.0, *) {
      return config.contentMarginsDisabled()
    }
    return config
  }
}

private struct HelmWidgetBackgroundModifier: ViewModifier {
  func body(content: Content) -> some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(for: .widget) {
        ZStack {
          G.base
          RadialGradient(
            colors: [Color.white.opacity(0.06), .clear],
            center: .topLeading,
            startRadius: 0,
            endRadius: 200
          )
        }
      }
    } else {
      content.background(G.base)
    }
  }
}

private extension View {
  func helmWidgetBackground() -> some View {
    modifier(HelmWidgetBackgroundModifier())
  }
}

#if DEBUG
@available(iOS 17.0, *)
#Preview("Small", as: .systemSmall) {
  HelmSummaryWidget()
} timeline: {
  HelmWidgetEntry(date: .now, payload: HelmWidgetProvider.demo)
}

@available(iOS 17.0, *)
#Preview("Medium", as: .systemMedium) {
  HelmSummaryWidget()
} timeline: {
  HelmWidgetEntry(date: .now, payload: HelmWidgetProvider.demo)
}

@available(iOS 17.0, *)
#Preview("Large", as: .systemLarge) {
  HelmSummaryWidget()
} timeline: {
  HelmWidgetEntry(date: .now, payload: HelmWidgetProvider.demo)
}

@available(iOS 17.0, *)
#Preview("Lock Inline", as: .accessoryInline) {
  HelmSummaryWidget()
} timeline: {
  HelmWidgetEntry(date: .now, payload: HelmWidgetProvider.demo)
}

@available(iOS 17.0, *)
#Preview("Lock Rect", as: .accessoryRectangular) {
  HelmSummaryWidget()
} timeline: {
  HelmWidgetEntry(date: .now, payload: HelmWidgetProvider.demo)
}

@available(iOS 17.0, *)
#Preview("Lock Circle", as: .accessoryCircular) {
  HelmSummaryWidget()
} timeline: {
  HelmWidgetEntry(date: .now, payload: HelmWidgetProvider.demo)
}
#endif
