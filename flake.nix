{
  description = "Development environment for the Estoma Angular application";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-darwin"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_22
              pkgs.corepack
              pkgs.chromium
            ];

            shellHook = ''
              # package.json pins pnpm to 10.12.1.  Corepack resolves that exact version.
              export COREPACK_ENABLE_PROJECT_SPEC=1
              export CHROME_BIN="${pkgs.chromium}/bin/chromium"
            '';
          };
        });
    };
}
