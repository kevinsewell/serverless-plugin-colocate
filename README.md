Serverless Colocate Plugin 
==========================
[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![npm version](https://badge.fury.io/js/serverless-plugin-colocate.svg)](https://badge.fury.io/js/serverless-plugin-colocate)
[![npm downloads](https://img.shields.io/npm/dm/serverless-plugin-colocate.svg)](https://www.npmjs.com/package/serverless-plugin-colocate)
[![license](https://img.shields.io/npm/l/serverless-plugin-colocate.svg)](https://raw.githubusercontent.com/aronim/serverless-plugin-colocate/master/LICENSE)

Colocate your Configuration and Code

**Requirements:**
* Serverless *v1.12.x* or higher.
* AWS provider

## How it works

Colocate allows you to keep your infrastructure configuration and code in the same place. Making it easier to reason 
and refactor your project.

### Setup

 Install via npm in the root of your Serverless service:
```
npm install serverless-plugin-colocate --save-dev
```

* Add the plugin to the `plugins` array in your Serverless `serverless.yml`:

```yml
plugins:
  - serverless-plugin-colocate
```

### Example 

##### Project Structure

```
<project_root>
- package1
  - hello.js
  - hello.yml
- package2
  - goodbye.js
  - goodbye.yml
- serverless.yml

```
##### serverless.yml
```yaml
service: ServerlessColocateExample

plugins:
  - serverless-plugin-colocate

provider:
  name: aws
  stage: ${opt:stage, "Test"}
  runtime: nodejs8.10
  role: DefaultRole

resources:
  Resources:
    DefaultRole:
      Type: AWS::IAM::Role
      Properties:
        Path: /
        RoleName: ${self:service}-${self:provider.stage}
        AssumeRolePolicyDocument:
          Version: "2012-10-17"
          Statement:
            - Effect: Allow
              Principal:
                Service:
                  - lambda.amazonaws.com
              Action: sts:AssumeRole
        Policies:
          - PolicyName: ${self:service}-${self:provider.stage}
            PolicyDocument:
              Version: "2012-10-17"
              Statement:
                - Effect: Allow
                  Action:
                    - logs:CreateLogGroup
                    - logs:CreateLogStream
                    - logs:PutLogEvents
                  Resource: arn:aws:logs:${self:provider.region}:*:log-group:/aws/lambda/*:*:*
```

##### package1/hello.yml
```yaml
provider:
  environment:
    HELLO_MESSAGE: Mholo
    
functions:
  Hello:
    handler: hello.handle
    events:
      - http:
          path: hello
          method: get
          cors: true
          
resources:
  Resources:
    HelloPolicy:
      Type: AWS::IAM::Policy
      DependsOn: DefaultRole
      Properties:
        PolicyName: ${self:service}-${self:provider.stage}-Hello
        PolicyDocument:
          Version: "2012-10-17"
          Statement:
            - Effect: Allow
              Action:
                - s3:GetObject
              Resource:
                - arn:aws:s3:::package2/*
        Roles:
          - ${self:service}-${self:provider.stage}
```

##### package2/goodbye.yml
```yaml
provider:
  environment:
    GOODBYE_MESSAGE: Hamba kakuhle
    
functions:
  Goodbye:
    handler: goodbye.handle
    events:
      - http:
          path: goodbye
          method: get
          cors: true

resources:  
  Resources:
    GoodbyePolicy:
      Type: AWS::IAM::Policy
      DependsOn: DefaultRole
      Properties:
        PolicyName: ${self:service}-${self:provider.stage}-Goodbye
        PolicyDocument:
          Version: "2012-10-17"
          Statement:
            - Effect: Allow
              Action:
                - s3:GetObject
              Resource:
                - arn:aws:s3:::package1/*
        Roles:
          - ${self:service}-${self:provider.stage}          
```

##### Effective serverless.yml
```yaml

service: ServerlessColocateExample

plugins:
  - serverless-plugin-colocate

provider:
  name: aws
  stage: ${opt:stage, "Test"}
  runtime: nodejs8.10
  role: DefaultRole
  environment:
    HELLO_MESSAGE: Mholo
    GOODBYE_MESSAGE: Hamba kakuhle 
    
functions:
  Hello:
    handler: package1/hello.handle     
    events:
      - http:
          path: hello
          method: get
          cors: true
  Goodbye:
    handler: package2/goodbye.handle
    events:
      - http:
          path: goodbye
          method: get
          cors: true
    
resources:
  Resources:
    DefaultRole:
      Type: AWS::IAM::Role
      Properties:
        Path: /
        RoleName: ${self:service}-${self:provider.stage}
        AssumeRolePolicyDocument:
          Version: "2012-10-17"
          Statement:
            - Effect: Allow
              Principal:
                Service:
                  - lambda.amazonaws.com
              Action: sts:AssumeRole
        Policies:
          - PolicyName: ${self:service}-${self:provider.stage}
            PolicyDocument:
              Version: "2012-10-17"
              Statement:
                - Effect: Allow
                  Action:
                    - logs:CreateLogGroup
                    - logs:CreateLogStream
                    - logs:PutLogEvents
                  Resource: arn:aws:logs:${self:provider.region}:*:log-group:/aws/lambda/*:*:*
    HelloPolicy:
      Type: AWS::IAM::Policy
      DependsOn: DefaultRole
      Properties:
      PolicyName: ${self:service}-${self:provider.stage}-Hello
        PolicyDocument:
          Version: "2012-10-17"
          Statement:
            - Effect: Allow
              Action:
                - s3:GetObject
              Resource:
                - arn:aws:s3:::package1/*
        Roles:
          - ${self:service}-${self:provider.stage}
    GoodbyePolicy:
      Type: AWS::IAM::Policy
      DependsOn: DefaultRole        
      Properties:
        PolicyName: ${self:service}-${self:provider.stage}-Goodbye
        PolicyDocument:
          Version: "2012-10-17"
          Statement:
            - Effect: Allow
              Action:
                - s3:GetObject
              Resource:
                - arn:aws:s3:::package2/*
        Roles:
          - ${self:service}-${self:provider.stage}
```

#### Function Handler Path
The plugin will prepend the correct path to function handler: ie. in the hello.yml the handler is simply 
`handler: hello.handle` but in the effective serverless.yml the Hello function handler is 
`handler: package1/hello.handle`

#### Skip a specific configuration file
If you want the plugin to ignore a particular configuration file, simply add `ignore: true` to the root of the 
configuration file. This is simpler than commenting out the entire file.

```yaml
ignore: true

functions:
  Hello:
    handler: hello.handle  

```

## Contribute

Help us making this plugin better and future proof.

* Clone the code
* Install the dependencies with `npm install`
* Create a feature branch `git checkout -b new_feature`
* Lint with standard `npm run lint`

## License

This software is released under the MIT license. See [the license file](LICENSE) for more details.