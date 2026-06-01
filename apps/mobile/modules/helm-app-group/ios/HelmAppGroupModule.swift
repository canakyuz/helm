import ExpoModulesCore
import WidgetKit

private let payloadKey = "helm_widget_payload"
private let payloadFile = "helm_widget_payload.json"

public class HelmAppGroupModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HelmAppGroup")

    Function("hasAppGroup") { (group: String) -> Bool in
      guard UserDefaults(suiteName: group) != nil else { return false }
      return FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: group
      ) != nil
    }

    Function("writeWidgetPayload") {
      (json: String, group: String, widgetKind: String) -> [String: Any] in
      var result: [String: Any] = [
        "ok": false,
        "hasContainer": false,
        "hasDefaults": false,
      ]

      guard let defaults = UserDefaults(suiteName: group) else {
        result["reason"] = "App Group UserDefaults unavailable"
        return result
      }
      result["hasDefaults"] = true

      guard let container = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: group
      ) else {
        result["reason"] = "App Group container unavailable"
        return result
      }
      result["hasContainer"] = true

      defaults.set(json, forKey: payloadKey)
      defaults.synchronize()

      let fileURL = container.appendingPathComponent(payloadFile)
      do {
        try json.write(to: fileURL, atomically: true, encoding: .utf8)
      } catch {
        result["reason"] = "File write failed: \(error.localizedDescription)"
        return result
      }

      let stored = defaults.string(forKey: payloadKey)
      result["defaultsHasKey"] = stored != nil
      result["ok"] = stored == json

      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
        WidgetCenter.shared.reloadAllTimelines()
      }

      return result
    }
  }
}
