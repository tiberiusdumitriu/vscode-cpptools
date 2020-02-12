/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All Rights Reserved.
 * See 'LICENSE' in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as os from 'os';
import * as util from './common';
import { LinuxDistribution } from './linuxDistribution';
import * as plist from 'plist';
import * as fs from 'fs';

export class PlatformInformation {
    constructor(public platform: string, public architecture: string, public distribution: LinuxDistribution, public version: string) { }

    public static GetPlatformInformation(): Promise<PlatformInformation> {
        let platform: string = os.platform();
        let architecturePromise: Promise<string>;
        let distributionPromise: Promise<LinuxDistribution> = Promise.resolve<LinuxDistribution>(null);
        let versionPromise: Promise<string> = Promise.resolve<string>(null);

        switch (platform) {
            case "win32":
                architecturePromise = PlatformInformation.GetWindowsArchitecture();
                break;

            case "linux":
                architecturePromise = PlatformInformation.GetUnixArchitecture();
                distributionPromise = LinuxDistribution.GetDistroInformation();
                break;

            case "darwin":
                architecturePromise = PlatformInformation.GetUnixArchitecture();
                versionPromise = PlatformInformation.GetDarwinVersion();
                break;
        }

        return Promise.all<string | LinuxDistribution>([architecturePromise, distributionPromise, versionPromise])
            .then(([arch, distro, version]: [string, LinuxDistribution, string]) => {
                return new PlatformInformation(platform, arch, distro, version);
            });
    }

    public static GetUnknownArchitecture(): string { return "Unknown"; }

    private static GetWindowsArchitecture(): Promise<string> {
        return util.execChildProcess('wmic os get osarchitecture', util.extensionPath)
            .then((architecture) => {
                if (architecture) {
                    let archArray: string[] = architecture.split(os.EOL);
                    if (archArray.length >= 2) {
                        let arch: string = archArray[1].trim();

                        // Note: This string can be localized. So, we'll just check to see if it contains 32 or 64.
                        if (arch.indexOf('64') >= 0) {
                            return "x86_64";
                        } else if (arch.indexOf('32') >= 0) {
                            return "x86";
                        }
                    }
                }
                return PlatformInformation.GetUnknownArchitecture();
            }).catch((error) => {
                return PlatformInformation.GetUnknownArchitecture();
            });
    }

    private static GetUnixArchitecture(): Promise<string> {
        return util.execChildProcess('uname -m', util.packageJson.extensionFolderPath)
            .then((architecture) => {
                if (architecture) {
                    return architecture.trim();
                }
                return null;
            });
    }

    private static GetDarwinVersion(): Promise<string> {
        const DARWIN_SYSTEM_VERSION_PLIST: string = "/System/Library/CoreServices/SystemVersion.plist";
        const systemVersionPListBuffer: Buffer = fs.readFileSync(DARWIN_SYSTEM_VERSION_PLIST);
        const systemVersionData: any = plist.parse(systemVersionPListBuffer.toString());
        return systemVersionData.ProductVersion;
    }
}
