#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import sys
import shutil
import urllib.request
import zipfile
import tarfile
from pathlib import Path

def download_file(url, dest):
    print(f"Downloading {url} to {dest}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'NAtlas-Runtime-Fetcher'})
    with urllib.request.urlopen(req) as response, open(dest, 'wb') as out_file:
        shutil.copyfileobj(response, out_file)
    print("Download complete.")

def extract_zip(src, dest_dir):
    print(f"Extracting {src} to {dest_dir}...")
    with zipfile.ZipFile(src, 'r') as zip_ref:
        zip_ref.extractall(dest_dir)

def extract_tar_gz(src, dest_dir):
    print(f"Extracting {src} to {dest_dir}...")
    with tarfile.open(src, "r:gz") as tar_ref:
        tar_ref.extractall(dest_dir)

def prepare_runtimes():
    project_root = Path(__file__).resolve().parent
    resources_dir = project_root / "resources"
    resources_dir.mkdir(exist_ok=True)

    temp_dir = project_root / "temp_runtimes"
    temp_dir.mkdir(exist_ok=True)

    is_mac = sys.platform == "darwin"
    is_win = sys.platform == "win32"

    # Define URL mappings
    urls = {}
    if is_mac:
        # macOS links (indygreg standalone python, node portable, desktop git portable)
        urls["python"] = "https://github.com/indygreg/python-build-standalone/releases/download/20240107/cpython-3.11.7+20240107-x86_64-apple-darwin-install_only.tar.gz"
        import platform
        arch = platform.machine().lower()
        if "arm" in arch or "aarch64" in arch:
            urls["node"] = "https://nodejs.org/dist/v24.2.0/node-v24.2.0-darwin-arm64.tar.gz"
        else:
            urls["node"] = "https://nodejs.org/dist/v24.2.0/node-v24.2.0-darwin-x64.tar.gz"
        urls["git"] = None  # macOS: git is always system-available; skip embedding
    elif is_win:
        # Windows links (python embedded, node portable, portable MinGit)
        urls["python"] = "https://www.python.org/ftp/python/3.11.7/python-3.11.7-embed-amd64.zip"
        urls["node"] = "https://nodejs.org/dist/v24.2.0/node-v24.2.0-win-x64.zip"
        urls["git"] = "https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/MinGit-2.43.0-64-bit.zip"
    else:
        print(f"Unsupported OS platform: {sys.platform}")
        return

    # 1. Python runtime
    py_dir = resources_dir / "python"
    if py_dir.exists():
        print("Python runtime already exists. Skipping...")
    else:
        py_archive = temp_dir / ("python.tar.gz" if is_mac else "python.zip")
        download_file(urls["python"], py_archive)
        
        py_extract_temp = temp_dir / "python_extracted"
        py_extract_temp.mkdir(exist_ok=True)
        
        if is_mac:
            extract_tar_gz(py_archive, py_extract_temp)
            src_install = py_extract_temp / "python"
            if src_install.exists():
                shutil.move(str(src_install), str(py_dir))
        else:
            extract_zip(py_archive, py_dir)
        
        # Install requirements into embedded Python's site-packages
        # Strategy: use the SYSTEM pip (sys.executable) with --target to install
        # packages directly into the embedded Python's site-packages directory.
        # This avoids all embedded Python pip bootstrap issues entirely.
        requirements_file = project_root / "src" / "python" / "requirements.txt"
        import subprocess
        
        if is_win:
            site_packages = py_dir / "Lib" / "site-packages"
            site_packages.mkdir(parents=True, exist_ok=True)
            
            # Patch _pth so embedded Python finds our site-packages at runtime
            pth_file = list(py_dir.glob("python*._pth"))
            if pth_file:
                content = pth_file[0].read_text(encoding="utf-8")
                additions = []
                if "Lib\\site-packages" not in content and "Lib/site-packages" not in content:
                    additions.append("Lib\\site-packages")
                if additions:
                    with open(pth_file[0], "a", encoding="utf-8") as f:
                        f.write("\n" + "\n".join(additions) + "\n")
                    print(f"Patched Windows Python _pth to include Lib\\site-packages: {pth_file[0]}")
            
            if requirements_file.exists():
                print("Installing Python requirements into embedded runtime (Windows, system pip --target)...")
                # Explicitly target cp311/win_amd64 to match the embedded Python 3.11 binary.
                # Without this, pip uses the CI runner's Python version tag (e.g. cp312),
                # producing _pydantic_core.cp312-win_amd64.pyd which embedded Python 3.11 cannot load.
                subprocess.check_call([
                    sys.executable, "-m", "pip", "install",
                    "-r", str(requirements_file),
                    "--target", str(site_packages),
                    "--python-version", "3.11",
                    "--platform", "win_amd64",
                    "--only-binary", ":all:",
                    "--implementation", "cp",
                    "--quiet"
                ])
                print("Python requirements installed.")
        else:
            python_exe = py_dir / "bin" / "python3"
            if requirements_file.exists():
                print("Installing Python requirements into embedded runtime (macOS)...")
                subprocess.check_call([str(python_exe), "-m", "pip", "install",
                                       "-r", str(requirements_file), "--quiet"])
                print("Python requirements installed.")
        
        print("Python runtime ready.")


    # 2. Node runtime
    node_dir = resources_dir / "node"
    if node_dir.exists():
        print("Node runtime already exists. Skipping...")
    else:
        node_archive = temp_dir / ("node.tar.gz" if is_mac else "node.zip")
        download_file(urls["node"], node_archive)
        
        node_extract_temp = temp_dir / "node_extracted"
        node_extract_temp.mkdir(exist_ok=True)
        
        if is_mac:
            extract_tar_gz(node_archive, node_extract_temp)
            extracted_folder = list(node_extract_temp.glob("node-v*"))[0]
            shutil.move(str(extracted_folder), str(node_dir))
        else:
            extract_zip(node_archive, node_extract_temp)
            extracted_folder = list(node_extract_temp.glob("node-v*"))[0]
            shutil.move(str(extracted_folder), str(node_dir))
            
        # Delete unused npm/node_modules to prevent electron-builder OOM and shrink app size
        npm_modules = node_dir / ("node_modules" if is_win else "lib/node_modules")
        if npm_modules.exists():
            shutil.rmtree(npm_modules)
            print(f"Removed unused npm modules to prevent builder scan: {npm_modules}")
        
        # Also clean up npm and corepack binaries/scripts
        npm_bins = []
        if is_win:
            npm_bins = ["npm", "npm.cmd", "npx", "npx.cmd", "corepack", "corepack.cmd"]
        else:
            npm_bins = ["bin/npm", "bin/npx", "bin/corepack"]
            
        for b in npm_bins:
            b_path = node_dir / b
            if b_path.is_symlink() or b_path.exists():
                b_path.unlink()
                print(f"Removed npm/corepack helper binary: {b_path}")
                    
        print("Node runtime ready.")

    # 3. Git runtime
    git_dir = resources_dir / "git"
    if git_dir.exists():
        print("Git runtime already exists. Skipping...")
    else:
        if is_mac:
            # macOS: git is always available system-wide via Xcode CLT or Homebrew.
            # We must NOT create symlinks to /usr/bin/git inside the app bundle
            # because codesign rejects symlinks pointing outside the bundle.
            # Instead, create an empty placeholder directory so electron-builder
            # won't error on missing extraResources source.
            git_dir.mkdir(parents=True, exist_ok=True)
            (git_dir / ".skip").write_text("macOS uses system git; no embedded binary needed.")
            print("Git runtime: using system git on macOS (no embedded binary).")
        elif is_win:
            git_archive = temp_dir / "git.zip"
            try:
                download_file(urls["git"], git_archive)
                extract_zip(git_archive, git_dir)
                print("Git runtime ready.")
            except Exception as download_err:
                raise download_err

    # Clean up temp
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
        print("Temporary download files cleaned up.")

    # 4. Prepare SwarmVault CLI isolated portable setup
    prepare_swarmvault_cli(project_root, resources_dir)

def prepare_swarmvault_cli(project_root, resources_dir):
    portable_dir = resources_dir / "swarmvault-cli-portable"
    # electron-builder silently excludes 'node_modules' folders from extraResources.
    # We install into a temp dir then rename node_modules → pkgs to bypass this.
    pkgs_dir = portable_dir / "pkgs"
    if pkgs_dir.exists():
        print("SwarmVault CLI portable already exists. Skipping...")
        return

    temp_install_dir = resources_dir / "swarmvault-cli-tmp"
    temp_install_dir.mkdir(parents=True, exist_ok=True)

    package_json_content = """{
  "name": "swarmvault-cli-portable",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@swarmvaultai/cli": "3.16.0"
  }
}
"""
    (temp_install_dir / "package.json").write_text(package_json_content, encoding="utf-8")

    import subprocess
    print("Installing SwarmVault CLI and dependencies into isolated folder...")

    is_win = sys.platform == "win32"
    subprocess.check_call(
        ["npm", "install", "--omit=dev", "--no-audit", "--no-fund"],
        cwd=str(temp_install_dir),
        shell=is_win
    )

    # Rename node_modules → pkgs so electron-builder does not strip it
    portable_dir.mkdir(parents=True, exist_ok=True)
    shutil.move(str(temp_install_dir / "node_modules"), str(pkgs_dir))
    shutil.rmtree(str(temp_install_dir))
    print(f"SwarmVault CLI portable installation complete. pkgs: {pkgs_dir}")

if __name__ == "__main__":
    prepare_runtimes()
