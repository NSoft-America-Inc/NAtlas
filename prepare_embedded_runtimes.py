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
            urls["node"] = "https://nodejs.org/dist/v22.11.0/node-v22.11.0-darwin-arm64.tar.gz"
        else:
            urls["node"] = "https://nodejs.org/dist/v22.11.0/node-v22.11.0-darwin-x64.tar.gz"
        urls["git"] = "https://github.com/desktop/desktop/releases/download/release-3.3.6/git-macOS-x64.tar.gz"
    elif is_win:
        # Windows links (python embedded, node portable, portable MinGit)
        urls["python"] = "https://www.python.org/ftp/python/3.11.7/python-3.11.7-embed-amd64.zip"
        urls["node"] = "https://nodejs.org/dist/v22.11.0/node-v22.11.0-win-x64.zip"
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
            pth_file = list(py_dir.glob("python*._pth"))
            if pth_file:
                with open(pth_file[0], "a", encoding="utf-8") as f:
                    f.write("\nimport site\n")
                print(f"Patched Windows Python _pth: {pth_file[0]}")
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
        git_archive = temp_dir / ("git.tar.gz" if is_mac else "git.zip")
        try:
            download_file(urls["git"], git_archive)
            if is_mac:
                git_extract_temp = temp_dir / "git_extracted"
                git_extract_temp.mkdir(exist_ok=True)
                extract_tar_gz(git_archive, git_extract_temp)
                shutil.move(str(git_extract_temp), str(git_dir))
            else:
                extract_zip(git_archive, git_dir)
            print("Git runtime ready.")
        except Exception as download_err:
            if is_mac:
                print(f"Warning: Failed to download macOS portable git ({download_err}). Falling back to copying system git...")
                git_bin_dir = git_dir / "bin"
                git_bin_dir.mkdir(parents=True, exist_ok=True)
                
                import subprocess
                try:
                    sys_git = subprocess.check_output(["which", "git"]).decode('utf-8').strip()
                    if sys_git and os.path.exists(sys_git):
                        dest_git = git_bin_dir / "git"
                        if dest_git.exists() or dest_git.is_symlink():
                            dest_git.unlink()
                        os.symlink(sys_git, dest_git)
                        print(f"Created symlink to system git from {sys_git} to {dest_git}")
                        
                        try:
                            sys_lfs = subprocess.check_output(["which", "git-lfs"]).decode('utf-8').strip()
                            if sys_lfs and os.path.exists(sys_lfs):
                                dest_lfs = git_bin_dir / "git-lfs"
                                if dest_lfs.exists() or dest_lfs.is_symlink():
                                    dest_lfs.unlink()
                                os.symlink(sys_lfs, dest_lfs)
                                print(f"Created symlink to system git-lfs from {sys_lfs}")
                        except Exception:
                            print("System git-lfs not found or failed to link. Skipping LFS...")
                    else:
                        raise FileNotFoundError("System git not found")
                except Exception as fallback_err:
                    print(f"Fatal: Failed to copy system git fallback ({fallback_err})")
                    raise fallback_err
            else:
                raise download_err

    # Clean up temp
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
        print("Temporary download files cleaned up.")

if __name__ == "__main__":
    prepare_runtimes()
