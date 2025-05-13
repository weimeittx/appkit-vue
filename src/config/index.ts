import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { mainnet, polygon, base, type AppKitNetwork, defineChain } from '@reown/appkit/networks'


export const projectId = import.meta.env.VITE_PROJECT_ID || "b56e18d47c72ab683b10814fe9495694" // this is a public projectId only to use on localhost
if (!projectId) {
  throw new Error('VITE_PROJECT_ID is not set')
}

// 自定义网络配置
const localNetwork = defineChain({
  id: 31337, // Hardhat本地网络的chainId
  caipNetworkId: 'eip155:31337',
  chainNamespace: 'eip155',
  name: '本地网络',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://localhost:8545'],
      webSocket: [],
    },
  },
  blockExplorers: {
    default: { 
      name: 'Explorer', 
      url: '' 
    },
  },
})

// 添加本地开发网络到网络列表
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [localNetwork, mainnet, polygon, base]

export const ethersAdapter = new EthersAdapter()