import * as path from "path";
import * as semver from "semver";

export class UpdateControllerBase {
	protected getPackageManifest: Function;

	constructor(protected $fs: IFileSystem,
		protected $platformCommandHelper: IPlatformCommandHelper,
		protected $platformsDataService: IPlatformsDataService,
		protected $packageInstallationManager: IPackageInstallationManager,
		protected $packageManager: IPackageManager,
		protected $pacoteService: IPacoteService) {
		this.getPackageManifest = _.memoize(this._getPackageManifest, (...args) => {
			return args.join("@");
		});
	}

	protected restoreBackup(folders: string[], backupDir: string, projectDir: string): void {
		for (const folder of folders) {
			this.$fs.deleteDirectory(path.join(projectDir, folder));

			const folderToCopy = path.join(backupDir, folder);

			if (this.$fs.exists(folderToCopy)) {
				this.$fs.copyFile(folderToCopy, projectDir);
			}
		}
	}

	protected backup(folders: string[], backupDir: string, projectDir: string): void {
		this.$fs.deleteDirectory(backupDir);
		this.$fs.createDirectory(backupDir);
		for (const folder of folders) {
			const folderToCopy = path.join(projectDir, folder);
			if (this.$fs.exists(folderToCopy)) {
				this.$fs.copyFile(folderToCopy, backupDir);
			}
		}
	}

	protected hasDependency(dependency: IDependency, projectData: IProjectData): boolean {
		const devDependencies = projectData.devDependencies;
		const dependencies = projectData.dependencies;

		return (dependencies && dependencies[dependency.packageName]) || (devDependencies && devDependencies[dependency.packageName]);
	}

	protected hasRuntimeDependency({ platform, projectData }: { platform: string, projectData: IProjectData }): boolean {
		const lowercasePlatform = platform.toLowerCase();
		const currentPlatformVersion = this.$platformCommandHelper.getCurrentPlatformVersion(lowercasePlatform, projectData);
		return !!currentPlatformVersion;
	}

	protected async getMaxRuntimeVersion({ platform, projectData }: { platform: string, projectData: IProjectData }) {
		const lowercasePlatform = platform.toLowerCase();
		const currentPlatformVersion = this.$platformCommandHelper.getCurrentPlatformVersion(lowercasePlatform, projectData);
		const platformData = this.$platformsDataService.getPlatformData(lowercasePlatform, projectData);
		if (currentPlatformVersion) {
			return await this.getMaxDependencyVersion(platformData.frameworkPackageName, currentPlatformVersion) || currentPlatformVersion;
		}
	}

	protected async getMaxDependencyVersion(dependency: string, version: string): Promise<string> {
		let maxDependencyVersion;
		if (semver.valid(version)) {
			maxDependencyVersion = version;
		} else if (semver.validRange(version)) {
			maxDependencyVersion = await this.$packageInstallationManager.maxSatisfyingVersion(dependency, version);
		} else {
			maxDependencyVersion = await this.$packageManager.getTagVersion(dependency, version);
		}

		return maxDependencyVersion;
	}

	private async _getPackageManifest(templateName: string, version: string): Promise<any> {
		const packageVersion = semver.valid(version) || await this.$packageManager.getTagVersion(templateName, version);

		if (packageVersion && semver.valid(packageVersion)) {
			return await this.$pacoteService.manifest(`${templateName}@${packageVersion}`, { fullMetadata: true });
		} else {
			throw new Error(`Failed to get information for package: ${templateName}@${version}`);
		}
	}
}
