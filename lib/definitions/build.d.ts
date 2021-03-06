interface IBuildData extends IPrepareData {
	device?: string;
	emulator?: boolean;
	clean: boolean;
	buildForDevice?: boolean;
	buildForAppStore?: boolean;
	buildOutputStdio?: string;
	outputPath?: string;
	copyTo?: string;
}

interface IiOSBuildData extends IBuildData {
	teamId: string;
	provision: string;
	mobileProvisionData: any;
	buildForAppStore: boolean;
	iCloudContainerEnvironment: string;
}

interface IAndroidBuildData extends IBuildData {
	keyStoreAlias: string;
	keyStorePath: string;
	keyStoreAliasPassword: string;
	keyStorePassword: string;
	androidBundle: boolean;
}

interface IBuildController {
	prepareAndBuild(buildData: IBuildData): Promise<string>;
	build(buildData: IBuildData): Promise<string>;
	buildIfNeeded(buildData: IBuildData): Promise<string>;
	shouldBuild(buildData: IBuildData): Promise<boolean>;
}

interface IBuildDataService {
	getBuildData(projectDir: string, platform: string, data: any): IBuildData;
}

interface IBuildArtefactsService {
	getAllAppPackages(buildOutputPath: string, validBuildOutputData: IValidBuildOutputData): IApplicationPackage[];
	getLatestAppPackagePath(platformData: IPlatformData, buildOutputOptions: IBuildOutputOptions): Promise<string>;
	copyLatestAppPackage(targetPath: string, platformData: IPlatformData, buildOutputOptions: IBuildOutputOptions): void;
}

interface IBuildInfoFileService {
	getLocalBuildInfo(platformData: IPlatformData, buildData: IBuildData): IBuildInfo;
	getDeviceBuildInfo(device: Mobile.IDevice, projectData: IProjectData): Promise<IBuildInfo>;
	saveLocalBuildInfo(platformData: IPlatformData, buildInfoFileDirname: string): void;
	saveDeviceBuildInfo(device: Mobile.IDevice, projectData: IProjectData, outputFilePath: string): Promise<void>;
}