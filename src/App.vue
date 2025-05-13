<template>
  <div class="pages">
    <h1>AppKit vue Example</h1>
    <appkit-button />
    <ActionButtonList />
    <button @click="getAddress">获取钱包地址</button>
    <div v-if="walletAddress">当前钱包地址: {{ walletAddress }}</div>
  </div>
</template>

<script setup lang="ts">
import {
  createAppKit,
  useAppKitAccount
} from '@reown/appkit/vue'
import { ethersAdapter, networks, projectId } from './config/index'
import { ref, onMounted } from 'vue'

import ActionButtonList from "./components/ActionButton.vue"

// 创建响应式变量存储钱包地址
const walletAddress = ref('')
const accountData = useAppKitAccount()

// Initialize AppKit
createAppKit({
  adapters: [ethersAdapter],
  networks,
  projectId,
  themeMode: 'light',
  features: {
    analytics: true, // Optional - defaults to your Cloud configuration
    swaps: false,
    email: false,
    send: false,
    socials: false
  },
  metadata: {
    name: 'AppKit Vue Example',
    description: 'AppKit Vue Example',
    url: 'https://reown.com/appkit',
    icons: ['https://avatars.githubusercontent.com/u/179229932?s=200&v=4']
  },
  themeVariables: {
    '--w3m-accent': '#000000',
  }
})

// 挂载时自动检查账户状态
onMounted(() => {
  checkAccount()
})

// 监听账户变化
const checkAccount = () => {
  if (accountData.value && accountData.value.address) {
    walletAddress.value = accountData.value.address
  }
}

const getAddress = () => {
  if (accountData.value && accountData.value.address) {
    walletAddress.value = accountData.value.address
    console.log('钱包地址:', accountData.value.address)
  } else {
    console.log('未连接钱包或未获取到地址')
  }
}
</script>