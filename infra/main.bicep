metadata description = 'Cinder - Persistent Vibe Coding Server'

param location string = 'swedencentral'

@description('VM size: burstable 2 vCPU, 4GB RAM')
param vmSize string = 'Standard_B2s'

@description('Administrator username')
param adminUsername string = 'cinder'

@description('SSH public key')
@secure()
param sshPublicKey string

@description('Entra ID tenant ID')
param entraTenantId string

@description('Entra ID client ID for app registration')
param entraClientId string

@description('Allowed SSH source IP (your home/office IP)')
param sshAllowedIp string = '0.0.0.0/0'

@description('Custom domain for the server')
param domainName string = ''

// --- Network Security Group ---
resource nsg 'Microsoft.Network/networkSecurityGroups@2024-01-01' = {
  name: 'cinder-nsg'
  location: location
  properties: {
    securityRules: [
      {
        name: 'AllowHTTPS'
        properties: {
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '443'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
          access: 'Allow'
          priority: 100
          direction: 'Inbound'
        }
      }
      {
        name: 'AllowHTTP'
        properties: {
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '80'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
          access: 'Allow'
          priority: 101
          direction: 'Inbound'
        }
      }
      {
        name: 'AllowSSH'
        properties: {
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '22'
          sourceAddressPrefix: sshAllowedIp
          destinationAddressPrefix: '*'
          access: 'Allow'
          priority: 110
          direction: 'Inbound'
        }
      }
      {
        name: 'DenyAllInbound'
        properties: {
          protocol: '*'
          sourcePortRange: '*'
          destinationPortRange: '*'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
          access: 'Deny'
          priority: 4096
          direction: 'Inbound'
        }
      }
    ]
  }
}

// --- Virtual Network ---
resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: 'cinder-vnet'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.1.0.0/16']
    }
    subnets: [
      {
        name: 'default'
        properties: {
          addressPrefix: '10.1.0.0/24'
          networkSecurityGroup: { id: nsg.id }
        }
      }
    ]
  }
}

// --- Public IP ---
resource publicIp 'Microsoft.Network/publicIPAddresses@2024-01-01' = {
  name: 'cinder-pip'
  location: location
  sku: { name: 'Standard' }
  properties: {
    publicIPAllocationMethod: 'Static'
    dnsSettings: {
      domainNameLabel: 'cinder-${uniqueString(resourceGroup().id)}'
    }
  }
}

// --- NIC ---
resource nic 'Microsoft.Network/networkInterfaces@2024-01-01' = {
  name: 'cinder-nic'
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          subnet: { id: '${vnet.id}/subnets/default' }
          privateIPAllocationMethod: 'Dynamic'
          publicIPAddress: { id: publicIp.id }
        }
      }
    ]
  }
}

// --- Virtual Machine ---
resource vm 'Microsoft.Compute/virtualMachines@2024-03-01' = {
  name: 'cinder-vm'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    hardwareProfile: { vmSize: vmSize }
    osProfile: {
      computerName: 'cinder'
      adminUsername: adminUsername
      linuxConfiguration: {
        disablePasswordAuthentication: true
        ssh: {
          publicKeys: [
            {
              path: '/home/${adminUsername}/.ssh/authorized_keys'
              keyData: sshPublicKey
            }
          ]
        }
      }
      customData: loadFileAsBase64('cloud-init.yaml')
    }
    networkProfile: {
      networkInterfaces: [{ id: nic.id }]
    }
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: '0001-com-ubuntu-server-noble'
        sku: '24_04-lts-gen2'
        version: 'latest'
      }
      osDisk: {
        createOption: 'FromImage'
        managedDisk: { storageAccountType: 'StandardSSD_LRS' }
        diskSizeGB: 64
      }
    }
  }
}

// --- Outputs ---
output vmPublicIp string = publicIp.properties.ipAddress
output vmFqdn string = publicIp.properties.dnsSettings.fqdn
output vmPrincipalId string = vm.identity.principalId
