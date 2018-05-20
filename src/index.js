"use strict";

const _ = require("lodash");
const YAML = require("js-yaml");
const walkDirSync = require("./libs/walkDirSync");

let shouldInclude = (filename, includes) => {

    if (!includes || includes.length === 0) return true;

    for (const include of includes) {
        if (filename.index(include) >= 0) return true;
    }

    return false;
};

let shouldNotExclude = (filename, excludes) => {

    if (!excludes || excludes.length === 0) return true;

    for (const exclude of excludes) {
        if (filename.indexOf(exclude) >= 0) return false;
    }

    return true;
};

let filenameEndsWithExtension = (filename, extension) =>
    filename.indexOf("." + extension) === (filename.length - (extension.length + 1));

let isYamlFile = (filename) =>
    filenameEndsWithExtension(filename, "yml") || filenameEndsWithExtension(filename, "yaml");


class ServerlessPluginColocate {
    constructor(serverless, options) {
        let self = this;
        this.serverless = serverless;
        this.options = options;
        this.appendConfig();

        this.commands = {
            colocate: {
                commands: {
                    effective: {
                        lifecycleEvents: ["effective"]
                    }
                }
            }
        };

        this.hooks = {
            "colocate:effective:effective": function () {
                self.printEffectiveConfig(self.serverless)
            }
        };
    }

    printEffectiveConfig(serverless) {

        let effectiveServiceConfig = {};

        let fieldsToOutput = ["custom", "functions", "package", "provider", "resources", "service"];

        fieldsToOutput.forEach(fieldName => {
            let fieldValue = serverless.service[fieldName];
            if (fieldValue && Object.keys(fieldValue).length > 0) {
                effectiveServiceConfig[fieldName] = fieldValue
            }
        });

        console.log(YAML.dump(effectiveServiceConfig));
    }

    appendConfig() {
        const servicePath = this.serverless.config.servicePath;
        let serverless = this.serverless;

        let configFragmentFilenames = this.getConfigFragmentFilenames(servicePath);

        if (configFragmentFilenames.length > 0) {
            configFragmentFilenames.forEach(function (configFilename) {

                let configFragmentFilePath = configFilename.substr(0, configFilename.lastIndexOf("/"));
                let relativeConfigFragmentFilePath = configFragmentFilePath.replace(servicePath + "/", "");

                let configFragment = serverless.utils.readFileSync(configFilename);
                if (configFragment) {
                    Object.keys(configFragment.functions).forEach(functionName => {
                        let function_ = configFragment.functions[functionName];
                        if (function_.handler.indexOf(relativeConfigFragmentFilePath) !== 0) {
                            function_.handler = relativeConfigFragmentFilePath + "/" + function_.handler;
                        }
                    });

                    this.serverless.service = _.merge(serverless.service || {}, configFragment);
                }
            }, this);
        }
    }

    getConfigFragmentFilenames() {
        const servicePath = this.serverless.config.servicePath;
        let files = walkDirSync(servicePath, {noLinks: true});

        let includes = [];
        let excludes = ["serverless.yml", "node_modules", ".serverless"];

        return files
            .filter(filename => isYamlFile(filename))
            .filter(filename => shouldInclude(filename, includes))
            .filter(filename => shouldNotExclude(filename, excludes));
    };
}

module.exports = ServerlessPluginColocate;
