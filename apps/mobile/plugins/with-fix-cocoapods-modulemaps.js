const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

const MARKER_MODULEMAPS = "# helm-fix-cocoapods-modulemaps";
const MARKER_REACTCODEGEN = "# helm-fix-react-codegen-headers";

/**
 * Pod post_install: modulemap symlinks + ReactCodegen ReactCommon headers.
 */
function withFixCocoaPodsModulemaps(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      if (!fs.existsSync(podfilePath)) return cfg;

      let podfile = fs.readFileSync(podfilePath, "utf8");
      let changed = false;

      if (!podfile.includes(MARKER_MODULEMAPS)) {
        const scriptPath = path.join(
          cfg.modRequest.projectRoot,
          "plugins",
          "fix-cocoapods-modulemaps.js",
        );
        const hook = `
    ${MARKER_MODULEMAPS}
    system("node", ${JSON.stringify(scriptPath)})
`;
        podfile = podfile.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|${hook}`,
        );
        changed = true;
      }

      if (!podfile.includes(MARKER_REACTCODEGEN)) {
        const hook = `
    ${MARKER_REACTCODEGEN}
    rn_path = config[:reactNativePath]
    react_codegen_header_paths = [
      File.expand_path("ReactCommon", rn_path),
      File.expand_path("ReactCommon/react/renderer/components/view/platform/cxx", rn_path),
    ]
    installer.pods_project.targets.each do |target|
      next unless target.name == "ReactCodegen"
      target.build_configurations.each do |bc|
        hsp = bc.build_settings["HEADER_SEARCH_PATHS"] || "$(inherited)"
        entries = hsp.is_a?(Array) ? hsp.dup : [hsp]
        react_codegen_header_paths.each do |dir|
          next if entries.any? { |e| e.to_s.include?(dir) }
          entries << "\\"#{dir}\\""
        end
        bc.build_settings["HEADER_SEARCH_PATHS"] = entries
        %w[OTHER_CFLAGS OTHER_CPLUSPLUSFLAGS OTHER_SWIFT_FLAGS].each do |key|
          val = bc.build_settings[key]
          next unless val.is_a?(String)
          bc.build_settings[key] = val.gsub(/-ivfsoverlay\\s+\\$\\(PODS_ROOT\\)\\/React-Core-prebuilt\\/React-VFS\\.yaml/, "").squeeze(" ").strip
        end
      end
    end
`;
        podfile = podfile.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|${hook}`,
        );
        changed = true;
      }

      if (changed) fs.writeFileSync(podfilePath, podfile);
      return cfg;
    },
  ]);
}

module.exports = withFixCocoaPodsModulemaps;
