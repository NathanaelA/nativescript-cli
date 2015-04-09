///<reference path=".d.ts"/>
"use strict";

import Future = require("fibers/future");
import npm = require("npm");
import path = require("path");
import semver = require("semver");
import shell = require("shelljs");
import helpers = require("./common/helpers");
import constants = require("./constants");
import options = require("./common/options");
import resolve = require("resolve");


export class NodePackageManager implements INodePackageManager {
	private static NPM_LOAD_FAILED = "Failed to retrieve data from npm. Please try again a little bit later.";
	private static NPM_REGISTRY_URL = "http://registry.npmjs.org/";

	private versionsCache: IDictionary<string[]>;

	constructor(private $logger: ILogger,
		private $errors: IErrors,
		private $fs: IFileSystem,
		private $lockfile: ILockFile) {
		this.versionsCache = {};
		this.load().wait();
	}

	public getCacheRootPath(): string {
		return npm.cache;
	}

	public addToCache(packageName: string, version: string): IFuture<void> {
		return (() => {
			this.addToCacheCore(packageName, version).wait();

			var packagePath = path.join(npm.cache, packageName, version, "package");
			if(!this.isPackageUnpacked(packagePath).wait()) {
				this.cacheUnpack(packageName, version).wait();
			}
		}).future<void>()();
	}

	public load(config?: any): IFuture<void> {
		var future = new Future<void>();
		npm.load(config, (err) => {
			if(err) {
				future.throw(err);
			} else {
				future.return();
			}
		});
		return future;
	}

	public install(packageName: string, opts?: INpmInstallOptions): IFuture<string> {
		return (() => {
			this.$lockfile.lock().wait();

			try {
				var packageToInstall = packageName;
				var pathToSave = (opts && opts.pathToSave) || npm.cache;
				var version = (opts && opts.version) || null;

				return this.installCore(packageToInstall, pathToSave, version).wait();
			} catch(error) {
				this.$logger.debug(error);
				this.$errors.fail("%s. Error: %s", NodePackageManager.NPM_LOAD_FAILED, error);
			} finally {
				this.$lockfile.unlock().wait();
			}

		}).future<string>()();
	}

	public getLatestVersion(packageName: string): IFuture<string> {
		var future = new Future<string>();

		npm.commands["view"]([packageName, "dist-tags"], [false], (err: any, data: any) => { // [false] - silent
			if(err) {
				future.throw(err);
			} else {
				var latestVersion = _.first(_.keys(data));
				this.$logger.trace("Using version %s. ", latestVersion);

				future.return(latestVersion);
			}
		});

		return future;
	}

	public getCachedPackagePath(packageName: string, version: string): string {
		return path.join(npm.cache, packageName, version, "package");
	}

	private installCore(packageName: string, pathToSave: string, version: string): IFuture<string> {
		return (() => {
			if (options.frameworkPath) {
				if (this.$fs.getFsStats(options.frameworkPath).wait().isFile()) {
					this.npmInstall(packageName, pathToSave, version).wait();
					var pathToNodeModules = path.join(pathToSave, "node_modules");
					var folders = this.$fs.readDirectory(pathToNodeModules).wait();
					return path.join(pathToNodeModules, folders[0]);
				}
				return options.frameworkPath;
			} else {

				try {
					// Search for locally installed modules first.
					// TRICKY: We assume the "main" file exists and it is in the root of the package.
					var packageFile = resolve.sync(packageName, { basedir: process.cwd() });
					var packageDir = path.dirname(packageFile);
					return packageDir;
				} catch (ex) {
				}

				version = version || this.getLatestVersion(packageName).wait();
				var packagePath = this.getCachedPackagePath(packageName, version);
				if (!this.isPackageCached(packagePath).wait()) {
					this.addToCacheCore(packageName, version).wait();
				}

				if(!this.isPackageUnpacked(packagePath).wait()) {
					this.cacheUnpack(packageName, version).wait();
				}
				return packagePath;
			}
		}).future<string>()();
	}

	private npmInstall(packageName: string, pathToSave: string, version: string): IFuture<void> {
		this.$logger.out("Installing ", packageName);

		var incrementedVersion = semver.inc(version, constants.ReleaseType.MINOR);
		if (!options.frameworkPath && packageName.indexOf("@") < 0) {
			packageName = packageName + "@<" + incrementedVersion;
		}

		var future = new Future<void>();
		npm.commands["install"](pathToSave, packageName, (err: Error, data: any) => {
			if(err) {
				future.throw(err);
			} else {
				this.$logger.out("Installed ", packageName);
				future.return(data);
			}
		});
		return future;
	}

	private isPackageCached(packagePath: string): IFuture<boolean> {
		return this.$fs.exists(packagePath);
	}

	private isPackageUnpacked(packagePath: string): IFuture<boolean> {
		return (() => {
			return this.$fs.getFsStats(packagePath).wait().isDirectory() &&
				this.$fs.enumerateFilesInDirectorySync(packagePath).length > 1;
		}).future<boolean>()();
	}

	private addToCacheCore(packageName: string, version: string): IFuture<void> {
		var future = new Future<void>();
		// cache.add = function (pkg, ver, where, scrub, cb)
		npm.commands["cache"].add(packageName, version, undefined, false, (err: Error, data: any) => {
			if(err) {
				future.throw(err);
			} else {
				future.return();
			}
		});
		return future;
	}

	public cacheUnpack(packageName: string, version: string, unpackTarget?: string): IFuture<void> {
		var future = new Future<void>();
		unpackTarget = unpackTarget || path.join(npm.cache, packageName, version, "package");
		// function unpack (pkg, ver, unpackTarget, dMode, fMode, uid, gid, cb)
		npm.commands["cache"].unpack(packageName, version, unpackTarget, null, null, null, null, (err: Error, data: any) => {
			if(err) {
				future.throw(err);
			} else {
				future.return();
			}
		});
		return future;
	}
}
$injector.register("npm", NodePackageManager);
