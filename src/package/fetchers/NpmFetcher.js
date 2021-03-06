'use strict';

const {
  filterReleases,
  getLatestVersion,
} = require('../../utils/spec');
const Package = require('../Package');
const Fetcher = require('./Fetcher');

class NpmFetcher extends Fetcher {
  /**
   * @param {HttpClient} httpClient
   * @param {GetTarballStats} getTarballStats
   */
  constructor(httpClient, getTarballStats) {
    super();
    this.httpClient = httpClient;
    this.getTarballStats = getTarballStats;
  }

  /**
   * @param {Package} pkg
   * @param {DependencySpec} dependencySpec
   * @return {Promise<Package>}
   */
  async fetch(pkg, { escapedName }) {
    const packageMetaUrl = 'http://registry.npmjs.org/' + escapedName;
    const packageFullMeta = await this.httpClient.getJson(packageMetaUrl);

    pkg.version = this.extractVersion(pkg, packageFullMeta);

    const packageJson = packageFullMeta.versions[pkg.version];

    pkg.dependencies = this.extractDependencies(packageJson);
    pkg.stats = this.extractStats(packageJson);
    pkg.requirements = this.extractRequirements(packageJson);

    if (!pkg.hasStats()) {
      pkg.stats = await this.fetchStats(packageJson.dist.tarball);
    }

    return pkg;
  }

  /**
   * @param {string} url
   * @return {Promise<Stats>}
   * @protected
   */
  async fetchStats(url) {
    if (url) {
      return this.getTarballStats(url, this.httpClient);
    }

    return { fileCount: 0, unpackedSize: 0 };
  }

  /**
   * @param {object} packageJson
   * @param {object} packageJson.dist
   * @param {string} packageJson.dist.tarball
   * @param {number} packageJson.dist.fileCount
   * @param {number} packageJson.dist.unpackedSize
   * @return {Stats}
   * @private
   */
  extractStats(packageJson) {
    let stats = {
      fileCount: -1,
      unpackedSize: -1,
    };

    const dist = packageJson.dist || {};

    if (dist.fileCount !== undefined && dist.unpackedSize !== undefined) {
      stats = {
        fileCount: dist.fileCount,
        unpackedSize: dist.unpackedSize,
      };
    }

    return stats;
  }

  /**
   * Return the exact version based on versionSpec and available versions
   * @param {Package} pkg
   * @param {any} packageMeta
   * @param {any} packageMeta.versions
   * @param {any} packageMeta['dist-tags']
   * @return {string}
   * @private
   */
  extractVersion(pkg, packageMeta) {
    let versionSpec = pkg.versionSpec || '*';
    if (versionSpec === 'latest') {
      versionSpec = '*';
    }

    const availableVersions = Object.keys(packageMeta.versions || {});
    let version = getLatestVersion(availableVersions, versionSpec);
    if (version) {
      return version;
    }

    const hasReleases = filterReleases(availableVersions).length > 0;

    if (versionSpec === '*' && !hasReleases && packageMeta['dist-tags']) {
      version = packageMeta['dist-tags'] && packageMeta['dist-tags'].latest;
    }

    if (version) {
      return version;
    }

    throw Error(`Could not find a satisfactory version for ${pkg}`);
  }
}

module.exports = NpmFetcher;
