"use strict";

/**
 * @module serverless-plugin-colocate
 *
 * @see {@link https://serverless.com/framework/docs/providers/aws/guide/plugins/}
 *
 * @requires "bluebird"
 * @requires "lodash"
 * @requires "js-yaml"
 * @requires "./lib/walkDirSync
 * */

const BbPromise = require("bluebird");
const _ = require("lodash");
const YAML = require("js-yaml");
const globby = require("globby");

/**
 * Update Handler file location with path from the configFragment
 *
 * @param functionName
 * @param configFragment
 *
 * @param relativeConfigFragmentFilePath
 */
let correctHandlerLocation = (functionName, configFragment, relativeConfigFragmentFilePath) => {

    const function_ = configFragment.functions[functionName];

    if (function_.handler.indexOf(relativeConfigFragmentFilePath) !== 0) {
        function_.handler = relativeConfigFragmentFilePath + "/" + function_.handler;
    }
};

/**
 * Add Exclude Pattern
 *
 * @param pattern
 * @param patterns
 */
let addExcludePattern = (pattern, patterns) => {
    if (pattern.charAt(0) !== "!") {
        patterns.push(`!${pattern}`);
    } else {
        patterns.push(pattern.substring(1));
    }
};

/**
 * Add Include Pattern
 *
 * @param pattern
 * @param patterns
 */
let addIncludePattern = (pattern, patterns) => patterns.push(pattern);

/**
 * @classdesc Colocate you configuration and code
 * @class ServerlessPluginColocate
 */
class ServerlessPluginColocate {

    /**
     *
     * @param serverless
     * @param options
     */
    constructor(serverless, options) {
        this.serverless = serverless;

        this.options = options;

        this.commands = {
            colocate: {
                usage: "Colocate you configuration and code",
                lifecycleEvents: ["colocate"],
                commands: {
                    effective: {
                        usage: "Print the effective serverless.yml",
                        lifecycleEvents: ["effective"]
                    }
                }
            }
        };

        this.hooks = {
            "colocate:colocate": this.printColocateUsage.bind(this),
            "colocate:effective:effective": this.printEffectiveConfig.bind(this)
        };

        this.mergeCodeFragmentsIntoService();
    }

    /**
     * Print Colocate Usage
     *
     * @returns {Promise}
     */
    printColocateUsage() {

        if (this.serverless.cli.generateCommandsHelp){
            this.serverless.cli.generateCommandsHelp(["colocate"]);    
        }
        
        return BbPromise.resolve();
    }

    /**
     * Print Effective Serverless.yml
     *
     * @returns {Promise}
     */
    printEffectiveConfig() {

        const effectiveServiceConfig = {};
        const fieldsToOutput = ["custom", "functions", "layers", "package", "provider", "resources", "service", "stepFunctions"];

        fieldsToOutput.forEach(fieldName => {
            let fieldValue = this.serverless.service[fieldName];
            if (fieldValue && Object.keys(fieldValue).length > 0) {
                effectiveServiceConfig[fieldName] = fieldValue
            }
        });

        this.serverless.cli.log("Effective serverless.yml:\n" + YAML.dump(effectiveServiceConfig));

        return BbPromise.resolve();
    }

    /**
     * Merge all configuration fragments into service configuration
     */
    mergeCodeFragmentsIntoService() {
        this.getConfigFragmentFilenames()
            .forEach(this.mergeConfigFragmentIntoService.bind(this));
    }

    /**
     * Merge configuration fragment into service configuration
     *
     * @param configFilename
     */
    mergeConfigFragmentIntoService(configFilename) {

        const servicePath = this.serverless.config.servicePath;
        const configFragmentFilePath = configFilename.substr(0, configFilename.lastIndexOf("/"));
        const relativeConfigFragmentFilePath = configFragmentFilePath.replace(servicePath + "/", "");
        const configFragment = this.serverless.utils.readFileSync(configFilename);

        // ignore field is present and true then ignore
        if (configFragment.ignore) {
            this.serverless.cli.log("Colocate is ignoring " + configFilename.replace(servicePath, ""));
            return;
        }

        delete configFragment.ignore;

        if (configFragment && configFragment.functions) {

            Object.keys(configFragment.functions).forEach(functionName =>
                correctHandlerLocation(functionName, configFragment, relativeConfigFragmentFilePath));
        }
        
        if (configFragment && configFragment.layers) {
            Object.keys(configFragment.layers).forEach(layerName => {
                if (configFragment.layers[layerName].package && configFragment.layers[layerName].package.artifact){
                    configFragment.layers[layerName].package.artifact = 
                        this.updateLocation(configFragment.layers[layerName].package.artifact, relativeConfigFragmentFilePath)
                }
            });
             
        }

        this.extendServiceConfigurationWithObject([],configFragment);
    }
    
    /**
     * Return string with updated location
     *
     * @param originalLocation String
     * @param relativePath String
     *
     * @param updatedLocation String
     */
    updateLocation ( originalLocation, relativePath) {

        if (originalLocation.indexOf(relativePath + "/") !== 0) {
            return relativePath + "/" + originalLocation;
        }
  
        return originalLocation;
    }    

     /**
     * Append a key to the list of configurationPathKeys
     *
     * @param configurationPathKeys
     * @param key
     */
    appendConfigurationPathKey(configurationPathKeys, key){
        let keys_ = _.cloneDeep(configurationPathKeys)
        keys_.push(key)
        return keys_;
    }

    /**
     * Extend the serverless Configuration with and object
     *
     * @param configurationPathKeys array of path keys e.g. [['provider'],['name']]
     * @param value e.g. aws
     */
    extendServiceConfigurationWithObject(configurationPathKeys, value){

        if (!configurationPathKeys){
            configurationPathKeys = []
        }

        if (value && typeof value == 'object'){
            Object.keys(value).forEach(key => {
                  this.extendServiceConfigurationWithObject(this.appendConfigurationPathKey(configurationPathKeys, key), value[key]);
                });
        }
        else if (Array.isArray(value)){
            value.forEach((element) => this.extendServiceConfigurationWithObject(configurationPathKeys, element));
        }
        else if (value){
            this.serverless.extendConfiguration(configurationPathKeys, value);
        }
    }

    /**
     * Search service paths recursively for Serverless configration fragment files
     *
     * @returns {*}
     */
    getConfigFragmentFilenames() {

        const servicePath = this.serverless.config.servicePath;

        const patterns = this.getCustomDefaultInclude() || ["**/*.yml", "**/*.yaml"];

        const defaultExclude = this.getCustomDefaultExclude() ||
            ["serverless.yml", "node_modules/**", "vendor/**"];

        defaultExclude.forEach((pattern) => addExcludePattern(pattern, patterns));

        this.getCustomExclude()
            .forEach((pattern) => addExcludePattern(pattern, patterns));

        return globby.sync(patterns, {
            cwd: servicePath,
            silent: true,
            follow: true,
            nodir: true
        });
    };

    /**
     * Get Custom Parameters
     *
     * @returns {*}
     */
    getCustomParameters() {
        return (this.serverless.service.custom && this.serverless.service.custom.colocate) || {};
    }

    /**
     * Get Custom Default Includes
     *
     * @returns [*]
     */
    getCustomDefaultInclude() {
        return (this.getCustomParameters().defaultInclude && this.getCustomParameters().defaultInclude.slice(0));
    }

    /**
     * Get Custom Default Excludes
     *
     * @returns [*]
     */
    getCustomDefaultExclude() {
        return (this.getCustomParameters().defaultExclude && this.getCustomParameters().defaultExclude.slice(0));
    }

    /**
     * Get Custom Excludes
     *
     * @returns [*]
     */
    getCustomExclude() {
        return (this.getCustomParameters().exclude && this.getCustomParameters().exclude.slice(0)) || [];
    }

}

/** Export ServerlessPluginColocate class */
module.exports = ServerlessPluginColocate;
