import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import * as core from "@actions/core";
import * as io from "@actions/io";
import * as exec from "@actions/exec";
import * as process from "process";
import * as cache from "@actions/cache";

export enum Inputs {
    VariantInstallFromGithub = "install-from-github" // Input for cache, restore action
}

export function utilsGetInputAsBool(
    name: string,
    options?: core.InputOptions
): boolean {
    const result = core.getInput(name, options);
    return result.toLowerCase() === "true";
}

const variantInstallFromGithub = utilsGetInputAsBool(Inputs.VariantInstallFromGithub);
        if (variantInstallFromGithub) {
            core.info(`global: variantInstallFromGithub is SET: ${variantInstallFromGithub}`);
        } else {
            core.info(`global: variantInstallFromGithub is NOT set: ${variantInstallFromGithub}`);
        }
        await execBash(`set -vx ; uname -a`);
//        await execBash(`set -vx ; uname -m`);
//        await execBash(`set -vx ; uname -n`);
//        await execBash(`set -vx ; uname -r`);
//        await execBash(`set -vx ; uname -s`);
//        await execBash(`set -vx ; uname -p`);
//        await execBash(`set -vx ; uname -v`);
// on macos 21.6.0 // uname: illegal option -- i //       await execBash(`set -vx ; uname -i`);
// on macos 21.6.0 // uname: illegal option -- o //       await execBash(`set -vx ; uname -o`);


const SELF_CI = process.env["CCACHE_ACTION_CI"] === "true"

// based on https://cristianadam.eu/20200113/speeding-up-c-plus-plus-github-actions-using-ccache/

async function restore(ccacheVariant : string) : Promise<void> {
  const inputs = {
    primaryKey: core.getInput("key"),
    // https://github.com/actions/cache/blob/73cb7e04054996a98d39095c0b7821a73fb5b3ea/src/utils/actionUtils.ts#L56
    restoreKeys: core.getInput("restore-keys").split("\n").map(s => s.trim()).filter(x => x !== "")
  };

  const keyPrefix = ccacheVariant + "-";
  const primaryKey = inputs.primaryKey ? keyPrefix + inputs.primaryKey + "-" : keyPrefix;
  const restoreKeys = inputs.restoreKeys.map(k => keyPrefix + k + "-")
  const paths = [`.${ccacheVariant}`];

  core.saveState("primaryKey", primaryKey);

  const restoredWith = await cache.restoreCache(paths, primaryKey, restoreKeys);
  if (restoredWith) {
    core.info(`Restored from cache key "${restoredWith}".`);
    if (SELF_CI) {
      core.setOutput("test-cache-hit", true)
    }
  } else {
    core.info("No cache found.");
    if (SELF_CI) {
      core.setOutput("test-cache-hit", false)
    }
  }
}

async function configure(ccacheVariant : string) : Promise<void> {
  const ghWorkSpace = process.env.GITHUB_WORKSPACE || "unreachable, make ncc happy";
  const maxSize = core.getInput('max-size');
  
  if (ccacheVariant === "ccache") {
    await execBash(`ccache --set-config=cache_dir='${path.join(ghWorkSpace, '.ccache')}'`);
    await execBash(`ccache --set-config=max_size='${maxSize}'`);
    await execBash(`ccache --set-config=compression=true`);
    core.info("Cccache config:");
    await execBash("ccache -p");
  } else {
    const options = `SCCACHE_IDLE_TIMEOUT=0 SCCACHE_DIR='${ghWorkSpace}'/.sccache SCCACHE_CACHE_SIZE='${maxSize}'`;
    await execBash(`env ${options} sccache --start-server`);
  }

}

async function installCcacheMac() : Promise<void> {
  //const variantInstallFromGithub = core.getBooleanInput("install-from-github");
  //core.saveState("variantInstallFromGithub", core.getBooleanInput("install-from-github"));
  //if (core.getState("variantInstallFromGithub") !== "true") {
//  const variantInstallFromGithub = core.getInput('install-from-github');
  if (variantInstallFromGithub) {
    core.warning('variantInstallFromGithub was IS set');
      } else {
    core.warning('variantInstallFromGithub was NOT set');
  }
  if (variantInstallFromGithub) {
    await installCcacheFromGitHub(
    "4.8",
    "darwin",
    "tar.gz",
    // sha256sum of ccache.exe
    "da05f0030ad083d9a1183dd68d11517c1a93dbd0e061af6fd8709d271150b6fc",
    "/usr/local/bin/",
    "ccache"
    );
  } else {
    await execBash("brew install ccache");
   }
}

async function installCcacheLinux() : Promise<void> {
  //const variantInstallFromGithub = core.getBooleanInput("install-from-github");
  //core.saveState("variantInstallFromGithub", core.getBooleanInput("install-from-github"));
  //if (core.getState("variantInstallFromGithub") !== "true") {
//  const variantInstallFromGithub = core.getInput('install-from-github');
  if (variantInstallFromGithub) {
    core.warning('variantInstallFromGithub was IS set');
      } else {
    core.warning('variantInstallFromGithub was NOT set');
  }
  if (variantInstallFromGithub) {
    await installCcacheFromGitHub(
    "4.7.5",
    "linux-x86_64",
    "tar.xz",
    // sha256sum of ccache
    "4c870947ca2f636b3069f2b9413d6919f5a1518dafbff03cd157564202337a7b",
    "/usr/local/bin/",
    "ccache"
    );
  } else {
    await execBashSudo("apt-get install -y ccache");
   }
}

async function installCcacheWindows() : Promise<void> {
  if (variantInstallFromGithub) {
    core.warning('variantInstallFromGithub was IS set');
      } else {
    core.warning('variantInstallFromGithub was NOT set');
  }
  if (variantInstallFromGithub) {
  await installCcacheFromGitHub(
    "4.7.5",
    "windows-x86_64",
    "zip",
    // sha256sum of ccache.exe
    "ac5918ea5df06d4cd2f2ca085955d29fe2a161f229e7cdf958dcf3e8fd5fe80e",
    // TODO find a better place
    `${process.env.USERPROFILE}\\.cargo\\bin`,
    "ccache.exe"
  );
  } else {
    await execBash("choco install ccache --version=4.8");
   }
}

async function installSccacheMac() : Promise<void> {
  //const variantInstallFromGithub = core.getBooleanInput("install-from-github");
  //core.saveState("variantInstallFromGithub", core.getBooleanInput("install-from-github"));
  //if (core.getState("variantInstallFromGithub") !== "true") {
//  const variantInstallFromGithub = core.getInput('install-from-github');
  if (variantInstallFromGithub) {
    core.warning('variantInstallFromGithub was IS set');
      } else {
    core.warning('variantInstallFromGithub was NOT set');
  }
  if (variantInstallFromGithub) {
   switch(process.arch) {
//   case 'x32':
//      console.log("This is a 32-bit extended systems");
//      break;
   case 'x64':
        await installSccacheFromGitHub(
          "v0.3.3",
          "x86_64-apple-darwin",
          "tar.gz",
          "f637e608cb52025fb7254d8d4aabe6abb4eb0dafa0e228cb14f0cd2f0eb5d833",
          "/usr/local/bin/",
          "sccache"
        );
      break;
   case 'arm':
      console.log("This is a 32-bit Advanced RISC Machine");
      break;
   case 'arm64':
        await installSccacheFromGitHub(
          "v0.3.3",
          "aarch64-apple-darwin",
          "tar.gz",
          "8fbcf63f454afce6755fd5865db3e207cdd408b8553e5223c9ed0ed2c6a92a09",
           "/usr/local/bin/",
          "sccache"
        );
      break;
   case 'mips':
      console.log("This is a 32-bit Microprocessor without " + "Interlocked Pipelined Stages");
      break;
   case 'ia32':
      console.log("This is a 32-bit Intel Architecture");
      break;
   case 'ppc':
      console.log("This is a PowerPC Architecture.");
      break;
   case 'ppc64':
      console.log("This is a 64-bit PowerPC Architecture.");
      break;
   // You can add more architectures if you know...
   default:
      console.log("This architecture is unknown.");
     } 
  } else {
   await execBash("brew install sccache");
  }
}

async function installSccacheLinux() : Promise<void> {
  await installSccacheFromGitHub(
    "v0.3.3",
    "x86_64-unknown-linux-musl",
    "tar.gz",
    "8fbcf63f454afce6755fd5865db3e207cdd408b8553e5223c9ed0ed2c6a92a09",
    "/usr/local/bin/",
    "sccache"
  );
}

async function installSccacheWindows() : Promise<void> {
  if (variantInstallFromGithub) {
    core.warning('variantInstallFromGithub was IS set');
      } else {
    core.warning('variantInstallFromGithub was NOT set');
  }
  if (variantInstallFromGithub) {
  await installSccacheFromGitHub(
    "v0.3.3",
    "x86_64-pc-windows-msvc",
    "tar.gz",
    "d4bdb5c60e7419340082283311ba6863def4f27325b08abc896211038a135f75",
    // TODO find a better place
    `${process.env.USERPROFILE}\\.cargo\\bin`,
    "sccache.exe"
  );
  } else {
    await execBash("choco install sccache --version=0.4.1");
   }
}

async function execBash(cmd : string) {
  await exec.exec("bash", ["-xc", cmd]);
}

async function execBashSudo(cmd : string) {
  await execBash("$(which sudo) " + cmd);
}

async function installCcacheFromGitHub(version : string, artifactName : string, artifactType : string, binSha256 : string, binDir : string, binName : string) : Promise<void> {
  const archiveName = `ccache-${version}-${artifactName}.${artifactType}`;
  const url = `https://github.com/ccache/ccache/releases/download/v${version}/${archiveName}`;
  const binPath = path.join(binDir, binName);
  //await downloadAndExtract(url, path.join(archiveName, binName), binPath);
  await downloadAndExtract(url, `*/${binName}`, binPath);
  checkSha256Sum(binPath, binSha256);
  await execBash(`chmod +x '${binPath}'`);
}

async function installSccacheFromGitHub(version : string, artifactName : string, artifactType : string, binSha256 : string, binDir : string, binName : string) : Promise<void> {
  const archiveName = `sccache-${version}-${artifactName}.${artifactType}`;
  const url = `https://github.com/mozilla/sccache/releases/download/${version}/${archiveName}`;
  const binPath = path.join(binDir, binName);
  await downloadAndExtract(url, `*/${binName}`, binPath);
  checkSha256Sum(binPath, binSha256);
  await execBash(`chmod +x '${binPath}'`);
}

async function downloadAndExtract (url : string, srcFile : string, dstFile : string) {
  if (url.endsWith(".zip")) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), ""));
    const zipName = path.join(tmp, "dl.zip");
    await execBash(`curl -L '${url}' -o '${zipName}'`);
    await execBash(`unzip '${zipName}' -d '${tmp}'`);
    const dstDir = path.dirname(dstFile);
    if (!fs.existsSync(dstDir)) {
      fs.mkdirSync(dstDir, { recursive: true });
    }
    fs.copyFileSync(path.join(tmp, srcFile), dstFile);
    fs.rmSync(tmp, { recursive: true });
  } else if (url.endsWith(".tar.xz")) {
    await execBash(`curl -L '${url}' | $(command -v gtar || command -v tar) xJf - -O --wildcards '${srcFile}' > '${dstFile}'`);
  } else {
    await execBash(`curl -L '${url}' | $(command -v gtar || command -v tar) xzf - -O --wildcards '${srcFile}' > '${dstFile}'`);
  }
}

function checkSha256Sum (path : string, expectedSha256 : string) {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(path));
  const actualSha256 = h.digest("hex");
  if (actualSha256  !== expectedSha256) {
    throw Error(`SHA256 of ${path} is ${actualSha256}, expected ${expectedSha256}`);
  }
}

async function runInner() : Promise<void> {
  const ccacheVariant = core.getInput("variant");
  core.saveState("ccacheVariant", ccacheVariant);
  core.saveState("shouldSave", core.getBooleanInput("save"));
  core.saveState("appendTimestamp", core.getBooleanInput("append-timestamp"));
  core.saveState("variantInstallFromGithub", core.getBooleanInput("install-from-github"));
  let ccachePath = await io.which(ccacheVariant);
  if (!ccachePath) {
    core.startGroup(`Install ${ccacheVariant}`);
    const installer = {
      ["ccache,linux"]: installCcacheLinux,
      ["ccache,darwin"]: installCcacheMac,
      ["ccache,win32"]: installCcacheWindows,
      ["sccache,linux"]: installSccacheLinux,
      ["sccache,darwin"]: installSccacheMac,
      ["sccache,win32"]: installSccacheWindows,
    }[[ccacheVariant, process.platform].join()];
    if (!installer) {
      throw Error(`Unsupported platform: ${process.platform}`)
    }
    await installer();
    core.info(await io.which(ccacheVariant + ".exe"));
    ccachePath = await io.which(ccacheVariant, true);
    core.endGroup();
  }

  core.startGroup("Restore cache");
  await restore(ccacheVariant);
  core.endGroup();

  core.startGroup(`Configure ${ccacheVariant}`);
  await configure(ccacheVariant);
  await execBash(`${ccacheVariant} -z`);
  core.endGroup();
}

async function run() : Promise<void> {
  try {
    await runInner();
  } catch (error) {
    core.setFailed(`Restoring cache failed: ${error}`);
  }
}

run();

export default run;
