"use strict";

const BbPromise = require("bluebird");
const _ = require("lodash");
const YAML = require("js-yaml");
const walkDirSync = require("./lib/walkDirSync");

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

let correctHandlerLocation = (functionName, configFragment, relativeConfigFragmentFilePath) => {

    const function_ = configFragment.functions[functionName];

    if (function_.handler.indexOf(relativeConfigFragmentFilePath) !== 0) {
        function_.handler = relativeConfigFragmentFilePath + "/" + function_.handler;
    }
};

class ServerlessPluginColocate {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
        this.mergeCodeFragmentsIntoService();

        this.commands = {
            colocate: {
                usage: "Colocate Configuration and Code",
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
            "colocate:colocate": () => {
                this.serverless.cli.generateCommandsHelp(["colocate"]);
                return BbPromise.resolve();
            },
            "colocate:effective:effective": () => {
                this.printEffectiveConfig();
                return BbPromise.resolve();
            }
        };
    }

    printEffectiveConfig() {

        const effectiveServiceConfig = {};
        const fieldsToOutput = ["custom", "functions", "package", "provider", "resources", "service"];

        fieldsToOutput.forEach(fieldName => {
            let fieldValue = this.serverless.service[fieldName];
            if (fieldValue && Object.keys(fieldValue).length > 0) {
                effectiveServiceConfig[fieldName] = fieldValue
            }
        });

        this.serverless.cli.log("Effective serverless.yml:\n" + YAML.dump(effectiveServiceConfig));
    }

    mergeCodeFragmentsIntoService() {
        this.getConfigFragmentFilenames()
            .forEach((codeFragmentFilename) =>
                this.mergeCodeFragmentIntoService(codeFragmentFilename));
    }

    mergeCodeFragmentIntoService(configFilename) {

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

        this.serverless.service = _.merge(this.serverless.service || {}, configFragment);
    }

    getConfigFragmentFilenames() {

        const servicePath = this.serverless.config.servicePath;
        const files = walkDirSync(servicePath, {noLinks: true});
        const includes = [];
        const excludes = ["serverless.yml", "node_modules", ".serverless"];

        return files
            .filter(filename => isYamlFile(filename))
            .filter(filename => shouldInclude(filename, includes))
            .filter(filename => shouldNotExclude(filename, excludes));
    };
}

module.exports = ServerlessPluginColocate;
