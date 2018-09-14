export class PreviewCommand implements ICommand {
	public allowedParameters: ICommandParameter[] = [];

	constructor(private $liveSyncService: ILiveSyncService,
		private $projectData: IProjectData,
		private $options: IOptions,
		private $playgroundQrCodeGenerator: IPlaygroundQrCodeGenerator,
		private $previewCommandHelper: IPreviewCommandHelper) { }

	public async execute(args: string[]): Promise<void> {
		this.$previewCommandHelper.run();

		await this.$liveSyncService.liveSync([], {
			syncToPreviewApp: true,
			projectDir: this.$projectData.projectDir,
			skipWatcher: !this.$options.watch,
			watchAllFiles: this.$options.syncAllFiles,
			clean: this.$options.clean,
			bundle: !!this.$options.bundle,
			release: this.$options.release,
			env: this.$options.env,
			timeout: this.$options.timeout
		});

		await this.$playgroundQrCodeGenerator.generateQrCodeForCurrentApp();
	}

	public async canExecute(args: string[]): Promise<boolean> {
		return true;
	}
}
$injector.registerCommand("preview", PreviewCommand);
