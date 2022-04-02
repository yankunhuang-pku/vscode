import * as fs from 'fs';
import * as path from 'path';

interface FhirElement {
    name: string,
    type: string,
    children: Map<string, string> // <property name, property type>
}

interface Item {
    method: string,
    path: string,
    children: Map<string, Item>
}

// config section
let primitiveType = new Set();
primitiveType.add("number");
let fhirSchemaFile = path.join(__dirname, '../src/fhir.schema.json');

let supportedResourceType = new Set();
supportedResourceType.add("Patient").add("Encounter").add("Account").add("Appointment").add("Observation").add("Claim");
let expandLevel = 3;
let mergeRule = true;
let debugDumpJson = true;
// end of config section

function buildTypeModel(FhirSchema)
{
    // Extract Type Definition
    let typeDefinition = new Map<string, FhirElement>();

    const types = Object.keys(FhirSchema["definitions"]);
    // remove ResourceList
    types.shift();    
    types.forEach(elementName => {
        let elementType = elementName;  
        let children = new Map<string, string>();
        
        if (FhirSchema["definitions"][elementName].hasOwnProperty("properties"))
        {
            let childrenName =  Object.keys(FhirSchema["definitions"][elementName]["properties"]);
            childrenName.forEach(childName => {
                // skip elements start with '-'
                if (childName.startsWith('_'))
                {
                    return;
                }
                // this element defined for resourceType, isn't a property, skip it
                if (childName === "resourceType")
                {
                    return;
                }

                // skip contained
                if (childName === "contained")
                {
                    return;
                }

                // this element is an array
                if (FhirSchema["definitions"][elementName]["properties"][childName]["type"] === "array")
                {
                    // enum type
                    if (FhirSchema["definitions"][elementName]["properties"][childName]["items"].hasOwnProperty("enum"))
                    {
                        children.set(childName, "string");
                    }
                    else if(FhirSchema["definitions"][elementName]["properties"][childName]["items"].hasOwnProperty("$ref")){
                        let ref: string = FhirSchema["definitions"][elementName]["properties"][childName]["items"]["$ref"];
                        children.set(childName, ref.substring(14));
                    }

                }
                else if (FhirSchema["definitions"][elementName]["properties"][childName].hasOwnProperty("type"))
                {
                    children.set(childName, FhirSchema["definitions"][elementName]["properties"][childName]["type"]);
                }
                // enum type
                else if (FhirSchema["definitions"][elementName]["properties"][childName].hasOwnProperty("enum"))
                {
                    children.set(childName, "string");
                }
                else
                {
                    let ref: string = FhirSchema["definitions"][elementName]["properties"][childName]["$ref"];
                    children.set(childName, ref.substring(14));
                }

            })
        }
        // primitive type
        else{
            // xhtml's type is undefined
            if (elementName != "xhtml") {
                elementType = FhirSchema["definitions"][elementName].type;
            }
            primitiveType.add(elementName);
        }        
        let createdFhirElement = {name: elementName, type: elementType, children: children};
        typeDefinition.set(elementName, createdFhirElement);

    });

    return typeDefinition;
}
function CreateConfig(ruleMap)
{
    // Load and Parse FHIRSchema as JSON
    let rawData = fs.readFileSync(fhirSchemaFile,'utf8');
    const FhirSchema = JSON.parse(rawData);
    
    // Build type model
    const typeDefinition = buildTypeModel(FhirSchema)
    

    // Generate De-id Config
    const resourceTypeList = Object.keys(FhirSchema["discriminator"]["mapping"]);
    let config = new Map<string, Item>();

    for (let resourceType of resourceTypeList){
        if (supportedResourceType.has(resourceType))
        {
            config.set(resourceType, GenerateItem(1, resourceType, "",resourceType, typeDefinition, ruleMap));
        }
    };
    let configJson = configToJson(config);
    if (debugDumpJson == true)
    {
        fs.writeFileSync("default.json", JSON.stringify(configJson,null, 4));
    }
    return configJson;
}

function configToJson(config: Map<string, Item>){
    let json = {};
    for (let [k,v] of config) {
        
        let value = {};
        value["method"] = v.method;
        value["path"] = v.path;
        value["children"] = {}
        if (v.children.size > 0)
            value["children"] = configToJson(v.children)
        json[k] = value;
    }
    return json;
}

function GenerateItem(level: number, type: string, fatherMethod: string, path: string, typeDefinition: Map<string, FhirElement>, ruleMap): Item
{
    //console.log(level + path);
    let method = fatherMethod;
    if (ruleMap.has(path))
    {
        method = ruleMap.get(path);
    }
    //console.log(level + path);
    let children = new Map<string, Item>();
    if (level < expandLevel)
    {
        if (!primitiveType.has(type))
        {
            if (!typeDefinition.has(type))
            {
                console.log(`undefined type ${type} in ${path}`);
            }
            else
            {            
                for (let [key, value] of typeDefinition.get(type).children){
                    //console.log("aaaa" + key + " " + value)
                    let subItem = GenerateItem(level+1, value, method, path+"."+key, typeDefinition, ruleMap);
                    children.set(key, subItem);
                }
            }

        }        
    }
    let createdItem = {method: method, path: path, children: children};
    return createdItem;
}

function generatePathConfig(config, fatherMethod:string) {
    let result = [];
    for (var k in config)
    {
        var subresult = generatePathConfig(config[k]["children"], config[k]["method"]);
        result = result.concat(subresult);

        if (config[k]["method"] != "" )
        {
            if (mergeRule == false || config[k]["method"]!= fatherMethod)
            {
                result.push({"path": config[k]["path"],"method": config[k]["method"]});
            }
        }

    }
    return result;
}

export function loadConfig(configFileName:string)
{
    let ruleMap = new Map<string, string>();
    let rawData = fs.readFileSync(configFileName,'utf8');
    const configJson = JSON.parse(rawData);
    let configPathRule = configJson["fhirPathRules"];
    for (let rule of configPathRule)
    {
        ruleMap.set(rule["path"], rule["method"])
    }

    let config = CreateConfig(ruleMap);
    return config;
}

export function saveConfig(config, fileName:string)
{
    let configigurationJson = {"fhirVersion": "R4", "processingErrors":"raise", "fhirPathRules":[], 
    "parameters": {
      "dateShiftKey": "",
      "dateShiftScope": "resource",
      "cryptoHashKey": "",
      "encryptKey": "",
      "enablePartialAgesForRedact": true,
      "enablePartialDatesForRedact": true,
      "enablePartialZipCodesForRedact": true,
      "restrictedZipCodeTabulationAreas": [
        "036",
        "059",
        "102",
        "203",
        "205",
        "369",
        "556",
        "692",
        "821",
        "823",
        "878",
        "879",
        "884",
        "893"
      ]
    }};
    configigurationJson["fhirPathRules"] = generatePathConfig(config, "")
    fs.writeFileSync(fileName, JSON.stringify(configigurationJson,null, 4))
}

export function createDefaultConfig()
{
    let config = CreateConfig(new Map<string, string>());
    return config;
}

let config = createDefaultConfig()
//let config = loadConfig("config.json");
config["Patient"]["children"]["meta"]["method"] = "keep";
saveConfig(config, "config_update.json");

