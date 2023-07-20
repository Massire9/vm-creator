import util from 'util';
import {ClientSecretCredential} from '@azure/identity';
import {ComputeManagementClient} from '@azure/arm-compute';
import {ResourceManagementClient} from '@azure/arm-resources';
import {StorageManagementClient} from '@azure/arm-storage';
import {NetworkManagementClient, PublicIPAddresses} from '@azure/arm-network';
import {setTimeout as st} from 'timers/promises';
// Store function output to be used elsewhere
let randomIds = {};
let subnetInfo = null;
let publicIPInfo = null;
let vmImageInfo = null;
let nicInfo = null;

let resourceGroupName
let vmName
let storageAccountName
let vnetName
let subnetName
let publicIPName
let networkInterfaceName
let ipConfigName
let domainNameLabel
let osDiskName

// CHANGE THIS - used as prefix for naming resources
let yourAlias = "resgrp";

// CHANGE THIS - used to add tags to resources
const projectName = "azure-samples-create-vm";

// Resource configs
const location = "francecentral";
const accType = "Standard_LRS";

// Ubuntu config for VM
const publisher = "Canonical";
const offer = "UbuntuServer";
const sku = "18.04-LTS";
let adminUsername = "vmuser";
let adminPassword = "Pa$$w0rd92";

// Azure authentication in environment variables for DefaultAzureCredential
const tenantId = process.env.AZURE_TENANT_ID;
const clientId = process.env.AZURE_CLIENT_ID;
const secret = process.env.AZURE_CLIENT_SECRET;
const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;

const credentials = new ClientSecretCredential(tenantId, clientId, secret);

const resourceClient = new ResourceManagementClient(credentials, subscriptionId);
const computeClient = new ComputeManagementClient(credentials, subscriptionId);
const storageClient = new StorageManagementClient(credentials, subscriptionId);
const networkClient = new NetworkManagementClient(credentials, subscriptionId);

export default async function createResources(username) {
    try {
        await generateNames()
        const result = await createResourceGroup();
        const accountInfo = await createStorageAccount();
        const vnetInfo = await createVnet();
        subnetInfo = await getSubnetInfo();
        publicIPInfo = await createPublicIP();
        nicInfo = await createNIC(subnetInfo, publicIPInfo);
        vmImageInfo = await findVMImage();
        const nicResult = await getNICInfo();
        const vmInfo = await createVirtualMachine(nicInfo.id, vmImageInfo[0].name);

        let flag = {
            username: adminUsername,
            password: adminPassword,
        };
        while (!flag.ip) {
            if (typeof await getVmIP() === 'string') {
                flag.ip = await getVmIP();
                console.log("VM IP: ", getVmIP());
            }
            await st(3000)
        }

        setTimeout(async () => {
            await resourceClient.resourceGroups.beginDelete(resourceGroupName);
        }, 1000 * 60 * 10);

        return flag;

    } catch (err) {
        console.log(err);
    }
}

const getVmIP = async () => {
    try {
        const vm = await computeClient.virtualMachines.get(
            resourceGroupName,
            vmName
        );
        const networkInterfaces = vm.networkProfile.networkInterfaces;

        if (networkInterfaces.length > 0) {
            const primaryNIC = networkInterfaces.find((nic) => nic.primary);
            if (primaryNIC) {
                const nic = await networkClient.networkInterfaces.get(
                    resourceGroupName,
                    getNicName(primaryNIC.id)
                );
                if (nic && nic.ipConfigurations.length > 0) {
                    const ipConfig = nic.ipConfigurations[0];
                    if (ipConfig.publicIPAddress && ipConfig.publicIPAddress.id) {
                        const publicIP = await networkClient.publicIPAddresses.get(
                            resourceGroupName,
                            getPublicIpName(ipConfig.publicIPAddress.id)
                        );
                        if (publicIP && publicIP.ipAddress) {
                            console.log("VM Public IP Address:", publicIP.ipAddress);
                            return publicIP.ipAddress;
                        } else {
                            console.log("No IP address found for the VM's public IP.");
                            return null;
                        }
                    } else {
                        console.log(
                            "No public IP address associated with the VM's primary network interface."
                        );
                    }
                } else {
                    console.log(
                        "No IP configurations found for the VM's primary network interface."
                    );
                }
            } else {
                console.log("No primary network interface found for the VM.");
            }
        } else {
            console.log("No network interfaces found for the VM.");
        }
    } catch (error) {
        console.log("An error occurred while retrieving the VM IP address:", error);
    }
};

const getPublicIpName = (publicIpId) => {
    // Extract the public IP name from its resource ID
    const parts = publicIpId.split("/");
    return parts[parts.length - 1];
};

const getNicName = (nicId) => {
    // Extract the NIC name from its resource ID
    const parts = nicId.split("/");
    return parts[parts.length - 1];
};

async function createResourceGroup() {
    console.log("\n1.Creating resource group: " + resourceGroupName);
    const groupParameters = {
        location: location,
        tags: {project: projectName},
    };
    const resCreate = await resourceClient.resourceGroups.createOrUpdate(
        resourceGroupName,
        groupParameters
    );
    return resCreate;
}

async function createStorageAccount() {
    console.log("\n2.Creating storage account: " + storageAccountName);
    const createParameters = {
        location: location,
        sku: {
            name: accType,
        },
        kind: "Storage",
        tags: {
            project: projectName,
        },
    };
    return await storageClient.storageAccounts.beginCreateAndWait(
        resourceGroupName,
        storageAccountName,
        createParameters
    );
}

async function createVnet() {
    console.log("\n3.Creating vnet: " + vnetName);
    const vnetParameters = {
        location: location,
        addressSpace: {
            addressPrefixes: ["10.0.0.0/16"],
        },
        dhcpOptions: {
            dnsServers: ["10.1.1.1", "10.1.2.4"],
        },
        subnets: [{name: subnetName, addressPrefix: "10.0.0.0/24"}],
    };
    return await networkClient.virtualNetworks.beginCreateOrUpdateAndWait(
        resourceGroupName,
        vnetName,
        vnetParameters
    );
}

async function getSubnetInfo() {
    console.log("\nGetting subnet info for: " + subnetName);
    return await networkClient.subnets.get(
        resourceGroupName,
        vnetName,
        subnetName
    );
}

async function createPublicIP() {
    console.log("\n4.Creating public IP: " + publicIPName);
    const publicIPParameters = {
        location: location,
        publicIPAllocationMethod: "Dynamic",
        dnsSettings: {
            domainNameLabel: domainNameLabel,
        },
    };
    return await networkClient.publicIPAddresses.beginCreateOrUpdateAndWait(
        resourceGroupName,
        publicIPName,
        publicIPParameters
    );
}

async function createNIC(subnetInfo, publicIPInfo) {
    console.log("\n5.Creating Network Interface: " + networkInterfaceName);
    const nicParameters = {
        location: location,
        ipConfigurations: [
            {
                name: ipConfigName,
                privateIPAllocationMethod: "Dynamic",
                subnet: subnetInfo,
                publicIPAddress: publicIPInfo,
            },
        ],
    };
    return await networkClient.networkInterfaces.beginCreateOrUpdateAndWait(
        resourceGroupName,
        networkInterfaceName,
        nicParameters
    );
}

async function findVMImage() {
    console.log(
        util.format(
            "\nFinding a VM Image for location %s from " +
            "publisher %s with offer %s and sku %s",
            location,
            publisher,
            offer,
            sku
        )
    );

    const result = await computeClient.virtualMachineImages.list(location, publisher, offer, sku)

    return result.map((item) => item);
}

async function getNICInfo() {
    return await networkClient.networkInterfaces.get(
        resourceGroupName,
        networkInterfaceName
    );
}

async function createVirtualMachine() {
    const vmParameters = {
        location: location,
        osProfile: {
            computerName: vmName,
            adminUsername: adminUsername,
            adminPassword: adminPassword,
        },
        hardwareProfile: {
            vmSize: "Standard_B1ls",
        },
        storageProfile: {
            imageReference: {
                publisher: publisher,
                offer: offer,
                sku: sku,
                version: "latest",
            },
            osDisk: {
                name: osDiskName,
                caching: "None",
                createOption: "fromImage",
                vhd: {
                    uri:
                        "https://" + storageAccountName + ".blob.core.windows.net/nodejscontainer/osnodejslinux.vhd",
                },
            },
        },
        networkProfile: {
            networkInterfaces: [
                {
                    id: nicInfo.id,
                    primary: true,
                },
            ],
        },
    };
    console.log("6.Creating Virtual Machine: " + vmName);
    console.log(
        " VM create parameters: " + util.inspect(vmParameters, {depth: null})
    );
    const resCreate = await computeClient.virtualMachines.beginCreateOrUpdateAndWait(
        resourceGroupName,
        vmName,
        vmParameters
    );
    return await computeClient.virtualMachines.get(
        resourceGroupName,
        vmName
    );
}

const _generateRandomId = (prefix, existIds) => {
    var newNumber;
    while (true) {
        newNumber = prefix + Math.floor(Math.random() * 10000);
        if (!existIds || !(newNumber in existIds)) {
            break;
        }
    }
    return newNumber;
};

const generateNames = async ()=> {
    //Random number generator for service names and settings
    resourceGroupName = _generateRandomId(`${yourAlias}-testrg`, randomIds);
    vmName = _generateRandomId(`${yourAlias}vm`, randomIds);
    storageAccountName = _generateRandomId(`${yourAlias}ac`, randomIds);
    vnetName = _generateRandomId(`${yourAlias}vnet`, randomIds);
    subnetName = _generateRandomId(`${yourAlias}subnet`, randomIds);
    publicIPName = _generateRandomId(`${yourAlias}pip`, randomIds);
    networkInterfaceName = _generateRandomId(`${yourAlias}nic`, randomIds);
    ipConfigName = _generateRandomId(`${yourAlias}crpip`, randomIds);
    domainNameLabel = _generateRandomId(`${yourAlias}domainname`, randomIds);
    osDiskName = _generateRandomId(`${yourAlias}osdisk`, randomIds);
}