<template>
  <div class="nft-marketplace">
    <div class="tabs-container">
      <div class="tabs">
        <div 
          :class="['tab', { active: activeTab === 'myNFTs' }]" 
          @click="activeTab = 'myNFTs'"
        >
          我的NFT
        </div>
        <div 
          :class="['tab', { active: activeTab === 'market' }]" 
          @click="activeTab = 'market'"
        >
          NFT市场
        </div>
      </div>
      <div class="action-buttons">
        <button class="mint-token-button" @click="openMintTokenModal" title="铸造ERC20代币">
          💰 铸造代币
        </button>
        <button class="refresh-button" @click="refreshData" title="刷新数据">
          🔄 刷新
        </button>
      </div>
    </div>

    <div class="tab-content">
      <!-- 我的NFT页签 -->
      <div v-if="activeTab === 'myNFTs'" class="my-nfts-tab">
        <!-- <h2>我的NFT</h2> -->
        <div class="actions-bar">
          <button class="mint-button" @click="openMintModal">铸造新NFT</button>
          <div v-if="isConnected" class="wallet-info">
            <!-- 当前钱包: {{ shortenAddress(currentAddress) }} -->
          </div>
          <div v-else class="wallet-warning">
            请先连接钱包
          </div>
        </div>
        <p v-if="isLoading">加载中...</p>
        <p v-else-if="!isConnected">请先连接钱包以查看您的NFT</p>
        <p v-else-if="myNFTs.length === 0">您暂无NFT</p>
        <div v-else class="nft-grid">
          <div v-for="nft in myNFTs" :key="nft.tokenId" class="nft-item" @click="openListModal(nft)">
            <div class="nft-image">NFT #{{ nft.tokenId }}</div>
            <div class="nft-info">
              <div class="nft-title">NFT #{{ nft.tokenId }}</div>
              <div class="nft-action">点击上架到市场</div>
            </div>
          </div>
        </div>
      </div>

      <!-- NFT市场页签 -->
      <div v-if="activeTab === 'market'" class="market-tab">
        <!-- <h2>NFT市场</h2> -->
        <p v-if="isLoading">加载中...</p>
        <p v-else-if="marketListings.length === 0">市场暂无上架NFT</p>
        <div v-else class="nft-grid">
          <div v-for="listing in marketListings" :key="`${listing.nftContract}-${listing.tokenId}`" class="nft-item" @click="buyNFT(listing)">
            <div class="nft-image">NFT #{{ listing.tokenId }}</div>
            <div class="nft-info">
              <div class="nft-title">NFT #{{ listing.tokenId }}</div>
              <div class="nft-price">价格: {{ listing.price }} {{ getTokenSymbol(listing.paymentToken) }}</div>
              <div class="nft-seller">卖家: {{ shortenAddress(listing.seller) }}</div>
              <div class="nft-action">点击购买</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 上架NFT弹窗 -->
    <div v-if="showListModal" class="modal">
      <div class="modal-content">
        <h3>上架NFT</h3>
        <p>NFT #{{ selectedNFT?.tokenId }}</p>
        
        <div class="form-group">
          <label>支付代币地址:</label>
          <input v-model="listingForm.paymentToken" placeholder="ERC20代币合约地址" />
        </div>
        
        <div class="form-group">
          <label>价格:</label>
          <input v-model="listingForm.price" placeholder="出售价格" type="number" />
        </div>
        
        <div class="modal-buttons">
          <button @click="listNFT">确认上架</button>
          <button @click="showListModal = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 铸造NFT弹窗 -->
    <div v-if="showMintModal" class="modal">
      <div class="modal-content">
        <h3>铸造新NFT</h3>
        
        <div class="form-group">
          <label>NFT ID:</label>
          <input v-model="mintForm.tokenId" placeholder="输入要铸造的NFT ID" type="number" />
        </div>
        
        <div class="modal-buttons">
          <button @click="mintNFT">确认铸造</button>
          <button @click="showMintModal = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 铸造ERC20代币弹窗 -->
    <div v-if="showMintTokenModal" class="modal">
      <div class="modal-content">
        <h3>铸造ERC20代币</h3>
        
        <div class="form-group">
          <label>ERC20合约地址:</label>
          <input v-model="mintTokenForm.contractAddress" placeholder="输入ERC20代币合约地址" />
        </div>
        
        <div class="form-group">
          <label>代币数量:</label>
          <input v-model="mintTokenForm.amount" placeholder="输入要铸造的代币数量" type="number" />
        </div>
        
        <div class="modal-buttons">
          <button @click="mintERC20Token">确认铸造</button>
          <button @click="showMintTokenModal = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, watch, computed } from 'vue'
import { useAppKitAccount } from '@reown/appkit/vue'
import { ethers } from 'ethers'
import erc721ABI from '../abi/erc721.json'
import erc20ABI from '../abi/erc20.json'
import marketABI from '../abi/NFTMarket.json'

// 定义接口
interface NFTItem {
  tokenId: string;
  contractAddress: string;
}

interface MarketListing {
  seller: string;
  nftContract: string;
  tokenId: string;
  paymentToken: string;
  price: string;
}

// 状态变量
const activeTab = ref('myNFTs')
const isLoading = ref(false)
const myNFTs = ref<NFTItem[]>([])
const marketListings = ref<MarketListing[]>([])
const showListModal = ref(false)
const showMintModal = ref(false)
const showMintTokenModal = ref(false)
const selectedNFT = ref<NFTItem | null>(null)
const listingForm = reactive({
  paymentToken: '',
  price: ''
})
const mintForm = reactive({
  tokenId: ''
})
const mintTokenForm = reactive({
  contractAddress: '',
  amount: ''
})

// 示例配置 - 实际使用时需要替换
const NFT_CONTRACT_ADDRESS = '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82' // 替换为实际NFT合约地址
const MARKET_CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3' // 替换为实际市场合约地址

// 获取账户数据
const accountData = useAppKitAccount()

// 计算属性：是否已连接钱包
const isConnected = computed(() => {
  return !!(accountData.value && accountData.value.address)
})

// 计算属性：当前钱包地址
const currentAddress = computed(() => {
  return accountData.value?.address || ''
})

// 监听钱包地址变化
watch(() => accountData.value?.address, async (newAddress, oldAddress) => {
  if (newAddress && newAddress !== oldAddress) {
    console.log('钱包地址已更改，重新加载数据:', newAddress)
    await loadMyNFTs()
    await loadMarketListings()
  }
}, { immediate: true })

// 初始化
onMounted(async () => {
  if (isConnected.value) {
    await loadMyNFTs()
    await loadMarketListings()
  }
})

// 加载我的NFT
const loadMyNFTs = async () => {
  try {
  console.log("loadMyNFTs");
    // 如果钱包未连接，清空NFT列表并返回
    if (!isConnected.value) {
      myNFTs.value = []
      console.log('钱包未连接，无法加载NFT')
      return
    }
    
    isLoading.value = true
    console.log('正在加载NFT，当前地址:', currentAddress.value)
    
    // 确保window.ethereum存在
    if (!window.ethereum) {
      console.error('没有检测到以太坊提供程序')
      return
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum as any)
    const signer = await provider.getSigner()
    const nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, erc721ABI, signer)
    
    // 获取用户拥有的NFT数量
    const balance = await nftContract.balanceOf(currentAddress.value)
    console.log('用户拥有NFT数量:', balance.toString())
    
    // 获取每个NFT的tokenId
    const nftItems: NFTItem[] = []
    for (let i = 0; i < balance; i++) {
      try {
        // 注意: 这个方法可能不是所有ERC721合约都有，可能需要替代方案
        const tokenId = await nftContract.tokenOfOwnerByIndex(currentAddress.value, i)
        nftItems.push({
          tokenId: tokenId.toString(),
          contractAddress: NFT_CONTRACT_ADDRESS
        })
      } catch (err) {
        console.error('获取NFT信息失败:', err)
        // 如果tokenOfOwnerByIndex方法不存在，尝试使用直接查询所有权的方式
        try {
          // 这里可以添加替代方案，如果合约不支持tokenOfOwnerByIndex
          // 例如，遍历所有可能的tokenId并检查所有者
          // 这需要根据具体合约设计调整
        } catch (fallbackErr) {
          console.error('替代方案也失败:', fallbackErr)
        }
      }
    }
    
    myNFTs.value = nftItems
    console.log('加载到的NFT列表:', nftItems)
  } catch (error) {
    console.error('加载NFT失败:', error)
    myNFTs.value = [] // 出错时清空列表
  } finally {
    isLoading.value = false
  }
}

// 加载市场上架的NFT
const loadMarketListings = async () => {
  try {
    isLoading.value = true
    console.log('正在加载市场列表')
    
    // 确保window.ethereum存在
    if (!window.ethereum) {
      console.error('没有检测到以太坊提供程序')
      return
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum as any)
    const marketContract = new ethers.Contract(MARKET_CONTRACT_ADDRESS, marketABI, provider)
    
    // 直接从合约中获取已上架的NFT列表
    console.log('开始获取已上架的NFT列表...')
    
    // 这里我们需要知道已经上架的NFT信息，可以有几种方法：
    // 1. 如果合约提供了一个方法返回所有活跃的上架信息，可以直接调用
    // 2. 如果合约只提供了查询单个上架信息的方法，可能需要遍历可能的tokenId范围
    
    const listings: MarketListing[] = []
    
    // 假设我们有一个合理的最大tokenId范围，例如测试环境可能只有少量NFT
    // 在实际生产环境中，可能需要更复杂的方案，如从API获取已知的tokenId列表
    const maxNFTId = 100 // 假设最大NFT ID不超过100
    
    // 遍历可能的NFT ID
    for (let tokenId = 1; tokenId <= maxNFTId; tokenId++) {
      try {
        // 查询每个NFT在市场上的上架情况
        const listing = await marketContract.listings(NFT_CONTRACT_ADDRESS, tokenId)
        
        // 如果这个NFT是活跃上架的，添加到列表中
        if (listing && listing.isActive) {
          listings.push({
            seller: listing.seller,
            nftContract: listing.nftContract,
            tokenId: tokenId.toString(),
            paymentToken: listing.paymentToken,
            price: ethers.formatEther(listing.price)
          })
          console.log('找到上架的NFT:', tokenId)
        }
      } catch (err) {
        console.error(`检查NFT(ID=${tokenId})上架状态时出错:`, err)
      }
    }
    
    marketListings.value = listings
    console.log('加载到的市场列表:', listings)
  } catch (error) {
    console.error('加载市场列表失败:', error)
    marketListings.value = [] // 出错时清空列表
  } finally {
    isLoading.value = false
  }
}

// 打开上架弹窗
const openListModal = (nft: NFTItem) => {
  if (!isConnected.value) {
    alert('请先连接钱包')
    return
  }
  selectedNFT.value = nft
  showListModal.value = true
}

// 打开铸造弹窗
const openMintModal = () => {
  if (!isConnected.value) {
    alert('请先连接钱包')
    return
  }
  showMintModal.value = true
}

// 铸造新NFT
const mintNFT = async () => {
  try {
    if (!mintForm.tokenId) {
      alert('请输入要铸造的NFT ID')
      return
    }
    
    if (!isConnected.value) {
      alert('请先连接钱包')
      return
    }
    
    // 确保window.ethereum存在
    if (!window.ethereum) {
      console.error('没有检测到以太坊提供程序')
      return
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum as any)
    const signer = await provider.getSigner()
    
    // 调用NFT合约的mint方法
    const nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, erc721ABI, signer)
    
    console.log('准备铸造NFT:', {
      address: currentAddress.value,
      tokenId: mintForm.tokenId
    })
    
    // 铸造NFT到用户地址
    const mintTx = await nftContract.mint(currentAddress.value, mintForm.tokenId)
    console.log('铸造交易已提交:', mintTx.hash)
    
    await mintTx.wait()
    console.log('铸造交易已确认')
    
    // 铸造成功
    alert('NFT铸造成功!')
    showMintModal.value = false
    mintForm.tokenId = ''
    
    // 重新加载数据
    await loadMyNFTs()
    
  } catch (error: any) {
    console.error('铸造NFT失败:', error)
    alert('铸造失败: ' + error.message)
  }
}

// 上架NFT到市场
const listNFT = async () => {
  try {
    if (!selectedNFT.value || !listingForm.paymentToken || !listingForm.price) {
      alert('请填写完整信息')
      return
    }
    
    // 确保window.ethereum存在
    if (!window.ethereum) {
      console.error('没有检测到以太坊提供程序')
      return
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum as any)
    const signer = await provider.getSigner()
    
    // 1. 首先授权市场合约操作NFT
    const nftContract = new ethers.Contract(selectedNFT.value.contractAddress, erc721ABI, signer)
    const approveNFTTx = await nftContract.approve(MARKET_CONTRACT_ADDRESS, selectedNFT.value.tokenId)
    await approveNFTTx.wait()
    
    // 2. 调用市场合约的上架方法
    const marketContract = new ethers.Contract(MARKET_CONTRACT_ADDRESS, marketABI, signer)
    const priceInWei = ethers.parseEther(`${listingForm.price}`)
    
    const listingTx = await marketContract.listNFT(
      selectedNFT.value.contractAddress,
      selectedNFT.value.tokenId,
      listingForm.paymentToken,
      priceInWei
    )
    await listingTx.wait()
    
    // 上架成功
    alert('NFT上架成功!')
    showListModal.value = false
    
    // 重新加载数据
    await loadMyNFTs()
    await loadMarketListings()
    
  } catch (error: any) {
    console.error('上架NFT失败:', error)
    alert('上架失败: ' + error.message)
  }
}

// 购买NFT
const buyNFT = async (listing: MarketListing) => {
  try {
    console.log('开始购买NFT:', {
      nftContract: listing.nftContract,
      tokenId: listing.tokenId,
      paymentToken: listing.paymentToken,
      price: listing.price
    });
    
    // 确保window.ethereum存在
    if (!window.ethereum) {
      console.error('没有检测到以太坊提供程序')
      return
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum as any)
    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress()
    console.log('当前账户地址:', signerAddress)
    
    // 检查NFT上架信息是否存在且激活
    const marketContract = new ethers.Contract(MARKET_CONTRACT_ADDRESS, marketABI, provider)
    const listingInfo = await marketContract.listings(listing.nftContract, listing.tokenId)
    console.log('NFT上架信息:', {
      seller: listingInfo.seller,
      nftContract: listingInfo.nftContract,
      tokenId: listingInfo.tokenId.toString(),
      paymentToken: listingInfo.paymentToken,
      price: ethers.formatEther(listingInfo.price),
      isActive: listingInfo.isActive
    })
    
    if (!listingInfo.isActive) {
      console.error('该NFT未上架或已售出')
      alert('该NFT未上架或已售出')
      await loadMarketListings() // 刷新市场列表
      return
    }
    
    // 检查用户是否有足够的代币余额
    const erc20Contract = new ethers.Contract(listingInfo.paymentToken, erc20ABI, provider)
    const userBalance = await erc20Contract.balanceOf(signerAddress)
    const price = listingInfo.price
    console.log('用户代币余额:', ethers.formatEther(userBalance), 'ETH')
    console.log('NFT价格:', ethers.formatEther(price), 'ETH')
    
    if (userBalance < price) {
      console.error('余额不足，无法购买')
      alert(`余额不足，无法购买。需要 ${ethers.formatEther(price)} 代币，但您只有 ${ethers.formatEther(userBalance)}`)
      return
    }
    
    // 1. 授权市场合约使用代币
    console.log('授权市场合约使用代币...')
    const erc20ContractWithSigner = new ethers.Contract(listingInfo.paymentToken, erc20ABI, signer)
    const approveTx = await erc20ContractWithSigner.approve(MARKET_CONTRACT_ADDRESS, price)
    console.log('授权交易已提交:', approveTx.hash)
    await approveTx.wait()
    console.log('授权交易已确认')
    
    // 检查授权是否成功
    const allowance = await erc20Contract.allowance(signerAddress, MARKET_CONTRACT_ADDRESS)
    console.log('授权额度:', ethers.formatEther(allowance), 'ETH')
    
    if (allowance < price) {
      console.error('授权失败，授权额度不足')
      alert('授权失败，请重试')
      return
    }
    
    // 2. 调用市场合约购买NFT
    console.log('调用buyNFT函数购买NFT...')
    const marketContractWithSigner = new ethers.Contract(MARKET_CONTRACT_ADDRESS, marketABI, signer)
    
    // 开启气体估算的调试
    const gasEstimate = await marketContractWithSigner.buyNFT.estimateGas(
      listing.nftContract, 
      listing.tokenId,
      { gasLimit: 1000000 } // 增加更高的gas限制
    )
    console.log('预估的gas消耗:', gasEstimate.toString())

    const gasLimitValue = Math.ceil(parseInt(gasEstimate.toString()) * 1.5) // 转换为数字并增加50%
    console.log('设置的gas限制:', gasLimitValue)

    const buyTx = await marketContractWithSigner.buyNFT(
      listing.nftContract, 
      listing.tokenId, 
      { 
        gasLimit: gasLimitValue
      }
    )
    console.log('购买交易已提交:', buyTx.hash)
    await buyTx.wait()
    console.log('购买交易已确认')
    
    // 购买成功
    alert('NFT购买成功!')
    
    // 重新加载数据
    await loadMyNFTs()
    await loadMarketListings()
    
  } catch (error: any) {
    console.error('购买NFT失败:', error)
    // 提取更详细的错误信息
    let errorMessage = error.message || '未知错误'
    
    // 检查常见的错误原因
    if (errorMessage.includes('insufficient funds')) {
      errorMessage = '钱包中的ETH不足以支付交易费用'
    } else if (errorMessage.includes('gas required exceeds allowance')) {
      errorMessage = '所需gas超过了设置的限制，请增加gas限制'
    } else if (error.code === 'CALL_EXCEPTION') {
      errorMessage = '合约调用异常，可能是上架信息已失效或权限问题'
    }
    
    alert('购买失败: ' + errorMessage)
  }
}

// 辅助函数 - 缩短地址显示
const shortenAddress = (address: string) => {
  if (!address) return ''
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
}

// 辅助函数 - 获取代币符号（此处为简化实现）
const getTokenSymbol = (tokenAddress: string) => {
  // 实际应用中，应该从合约中获取代币符号
  return 'TOKEN'
}

// 添加刷新功能
const refreshData = async () => {
  if (isConnected.value) {
    await loadMyNFTs()
    await loadMarketListings()
  } else {
    myNFTs.value = []
    marketListings.value = []
  }
}

// 打开铸造代币弹窗
const openMintTokenModal = () => {
  if (!isConnected.value) {
    alert('请先连接钱包')
    return
  }
  showMintTokenModal.value = true
}

// 铸造ERC20代币
const mintERC20Token = async () => {
  try {
    if (!mintTokenForm.contractAddress || !mintTokenForm.amount || Number(mintTokenForm.amount) <= 0) {
      alert('请输入有效的ERC20合约地址和代币数量')
      return
    }
    
    if (!isConnected.value) {
      alert('请先连接钱包')
      return
    }
    
    // 确保window.ethereum存在
    if (!window.ethereum) {
      console.error('没有检测到以太坊提供程序')
      return
    }
    
    const amount = ethers.parseEther(`${mintTokenForm.amount}`)
    console.log('准备铸造代币:', {
      address: currentAddress.value,
      amount: mintTokenForm.amount,
      amountInWei: amount.toString()
    })
    
    const provider = new ethers.BrowserProvider(window.ethereum as any)
    const signer = await provider.getSigner()
    
    // 调用ERC20合约的mint方法
    const erc20Contract = new ethers.Contract(mintTokenForm.contractAddress, erc20ABI, signer)
    
    // 检查合约是否有mint方法
    if (!erc20Contract.mint) {
      console.error('合约没有mint方法')
      alert('该ERC20合约不支持直接铸造，请联系管理员')
      return
    }
    
    // 铸造代币
    const mintTx = await erc20Contract.mint(currentAddress.value, amount)
    console.log('铸造交易已提交:', mintTx.hash)
    
    await mintTx.wait()
    console.log('铸造交易已确认')
    
    // 铸造成功
    alert('代币铸造成功!')
    showMintTokenModal.value = false
    mintTokenForm.contractAddress = ''
    mintTokenForm.amount = ''
    
  } catch (error: any) {
    console.error('铸造代币失败:', error)
    alert('铸造失败: ' + error.message)
  }
}
</script>

<style scoped>
.nft-marketplace {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.tabs-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #eee;
}

.tab {
  padding: 10px 20px;
  cursor: pointer;
}

.tab.active {
  border-bottom: 2px solid #000;
  font-weight: bold;
}

.refresh-button, .mint-token-button {
  padding: 5px 10px;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.refresh-button:hover, .mint-token-button:hover {
  background-color: #e5e5e5;
}

.mint-token-button {
  background-color: #4caf50;
  color: white;
  border-color: #45a049;
}

.mint-token-button:hover {
  background-color: #45a049;
}

.actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.wallet-info {
  font-size: 14px;
  color: #4CAF50;
}

.wallet-warning {
  font-size: 14px;
  color: #f44336;
}

.mint-button {
  padding: 10px 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.mint-button:hover {
  background-color: #45a049;
}

.nft-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}

.nft-item {
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s;
}

.nft-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}

.nft-image {
  height: 200px;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #888;
}

.nft-info {
  padding: 15px;
}

.nft-title {
  font-weight: bold;
  margin-bottom: 5px;
}

.nft-price, .nft-seller {
  font-size: 14px;
  color: #666;
  margin-top: 5px;
}

.nft-action {
  margin-top: 10px;
  font-size: 14px;
  color: #2196F3;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
}

.form-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.modal-buttons button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.modal-buttons button:first-child {
  background-color: #000;
  color: white;
}

.modal-buttons button:last-child {
  background-color: #eee;
}
</style> 