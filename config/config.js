const { ethers } = require('ethers');

module.exports = {
  Config: {
    Network: {
      name: 'Sepolia',
      chainId: 11155111,
      rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
      explorer: 'https://sepolia.etherscan.io'
    },

    ContractsAddress: {
      // Tokens
      R2: '0xb816bB88f836EA75Ca4071B46FF285f690C43bb7',
      USDC: '0x8bebfcbe5468f146533c182df3dfbf5ff9be00e2',
      R2USD: '0x9e8FF356D35a2Da385C546d6Bf1D77ff85133365',
      sR2USD: '0x006CbF409CA275bA022111dB32BDAE054a97d488',
      wBTC: '0x4f5b54d4af2568cefafa73bb062e5d734b55aa05',
      R2wBTC: '0xDcb5C62EaC28d1eFc7132ad99F2Bd81973041D14',

      // Uniswap V2 Style Pairs & Router
      uniswapRouter: '0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3',
      pair_R2_USDC: '0xCdfDD7dD24bABDD05A2ff4dfcf06384c5Ad661a9',
      pair_R2_R2USD: '0x9Ae18109692b43e95Ae6BE5350A5Acc5211FE9a1',

      // Curve Style Pools
      pool_R2USD_USDC: '0x47d1B0623bB3E557bF8544C159c9ae51D091F8a2',
      pool_sR2USD_R2USD: '0xe85A06C238439F981c90b2C91393b2F3c46e27FC',
    },

    Router: {
      stakingAddress: '0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3', // Also Uniswap Router
      swapAddress: '0x47d1B0623bB3E557bF8544C159c9ae51D091F8a2',
      stakewBtc: '0x23b2615d783E16F14B62EfA125306c7c69B4941A',
      stakeR2usd: '0x006CbF409CA275bA022111dB32BDAE054a97d488', // New staking address for R2USD -> sR2USD
      stakingMethodId: '0x1a5f0f00',
      buyMethodId: '0x095e7a95',
      sellMethodId: '0x3df02124'
    },

    Abi: {
      Erc20: [
        'function approve(address spender, uint256 amount) public returns (bool)',
        'function balanceOf(address account) public view returns (uint256)',
        'function decimals() public view returns (uint8)',
        'function allowance(address owner, address spender) external view returns (uint256)'
      ],
      Swap: [
        'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)'
      ],
      Staking: [
        'function stake(address _candidate, uint256 _amount) external',
        'function getStakedAmount(address _user) public view returns (uint256)'
      ],
      StakeR2USD: [
        "function stake(uint256 _amount) external"
      ],
      Pool: [
        "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external returns (uint256 amountA, uint256 amountB, uint256 liquidity)"
      ],
      Pair: [
        'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
        'function token0() external view returns (address)',
        'function token1() external view returns (address)'
      ],
      CurvePool: [
        "function add_liquidity(uint256[] calldata amounts, uint256 min_mint_amount, address receiver) external returns (uint256)"
      ]
    },

    gasSettings: {
      maxFeePerGas: ethers.parseUnits('50', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
      gasLimit: 500000
    }
  }
};