require('dotenv').config();
const { ethers } = require('ethers');
const { Config } = require('./config/config');
let amounts = require('./amount.json'); 
const log = require('./config/logger');
const { scriptInfo } = require('./config/banner');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { checkAndSetupConfiguration } = require('./setup');

const operationResults = {};
let operationLoops = {};
let proxyList = [];
let currentProxyIndex = 0;
const HOURS_24 = 24 * 60 * 60 * 1000;

try {
  if (fs.existsSync('./loop.json')) {
    operationLoops = JSON.parse(fs.readFileSync('./loop.json', 'utf-8'));
    log.info('Loaded operation loops configuration from loop.json');
  } else {
    log.warn('loop.json not found. Using default loop value of 1 for all operations.');
  }
} catch (error) {
  log.error(`Failed to load loop configuration: ${error.message}`);
}

const getLoopCount = (name) => operationLoops[name] || 1;

function loadProxies() {
  try {
    if (fs.existsSync('./proxy.txt')) {
      const proxyFile = fs.readFileSync('./proxy.txt', 'utf-8');
      proxyList = proxyFile.split('\n').filter(line => line.trim() !== '');
      log.info(`Loaded ${proxyList.length} proxies from proxy.txt`);
    } else {
      log.warn('proxy.txt not found. Proceeding without proxies');
    }
  } catch (error) {
    log.error(`Failed to load proxies: ${error.message}`);
  }
}

function getNextProxy() {
  if (proxyList.length === 0) return null;
  const proxy = proxyList[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;
  return proxy;
}

async function createProviderWithProxy(rpcUrl, chainId) {
  try {
    const proxy = getNextProxy();
    
    if (!proxy) {
      log.info('No proxy available, creating direct connection');
      return new ethers.JsonRpcProvider(rpcUrl, chainId);
    }
    
    log.info(`Using proxy: ${proxy}`);
    const agent = new HttpsProxyAgent(`http://${proxy}`);
    
    const provider = new ethers.JsonRpcProvider(rpcUrl, chainId, {
      staticNetwork: true,
      batchStallTime: 1000,
      batchMaxCount: 1,
      agent: agent
    });

    await provider.getBlockNumber();
    log.success('Proxy connection successful');
    return provider;
  } catch (error) {
    log.error(`Failed to connect with proxy: ${error.message}`);
    log.warn('Falling back to direct connection');
    return new ethers.JsonRpcProvider(rpcUrl, chainId);
  }
}

function randomDelay(minSeconds = 5, maxSeconds = 15) {
  const delayMs = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) * 1000;
  log.info(`Waiting ${delayMs/1000} seconds before next operation...`);
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

function randomSmallDelay(minMs = 500, maxMs = 3000) {
  const delayMs = Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

async function executeWithRetry(operationFn, operationName, params, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      log.step(`Attempt ${attempt} of ${maxAttempts} for ${operationName}`);
      await randomSmallDelay();
      return await operationFn(...params);
    } catch (error) {
      lastError = error;
      log.error(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt < maxAttempts) {
        const delayTime = Math.min(attempt * 10, 30);
        log.info(`Waiting ${delayTime} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayTime * 1000));
      }
    }
  }
  throw lastError;
}

async function initializeWallet(privateKey) {
  loadProxies();
  log.step(`Connecting to ${Config.Network.name} network...`);
  const provider = await createProviderWithProxy(Config.Network.rpcUrl, Config.Network.chainId);
  const wallet = new ethers.Wallet(privateKey, provider);
  log.wallet(`Wallet initialized: ${wallet.address}`);
  return wallet;
}

async function checkBalance(wallet, tokenAddress) {
  const tokenContract = new ethers.Contract(tokenAddress, Config.Abi.Erc20, wallet);
  const balance = await tokenContract.balanceOf(wallet.address);
  const decimals = await tokenContract.decimals();
  return ethers.formatUnits(balance, decimals);
}

async function approveToken(wallet, tokenAddress, spenderAddress, amount) {
  const tokenContract = new ethers.Contract(tokenAddress, Config.Abi.Erc20, wallet);
  const decimals = await tokenContract.decimals();
  const amountInWei = ethers.parseUnits(amount.toString(), decimals);
  const currentAllowance = await tokenContract.allowance(wallet.address, spenderAddress);
  if (currentAllowance >= amountInWei) {
    log.info(`Sufficient allowance for ${amount} tokens to ${spenderAddress} already exists`);
    return true;
  }
  log.step(`Approving ${amount} tokens for spender ${spenderAddress}...`);
  const tx = await tokenContract.approve(spenderAddress, amountInWei, { gasLimit: Config.gasSettings.gasLimit });
  log.tx(`Transaction sent: ${tx.hash}`);
  log.explorer(`${Config.Network.explorer}/tx/${tx.hash}`);
  await tx.wait();
  log.success('Approval completed');
  return true;
}

async function ensureSufficientBalance(wallet, tokenAddress, requiredAmount, operationName) {
  const balance = await checkBalance(wallet, tokenAddress);
  if (parseFloat(balance) < parseFloat(requiredAmount)) {
    throw new Error(`Insufficient balance for ${operationName}. Required: ${requiredAmount}, have: ${balance}`);
  }
  return true;
}

async function buyUsdcToR2usd(wallet, amount) {
  await ensureSufficientBalance(wallet, Config.ContractsAddress.USDC, amount, 'buyUsdcToR2usd');
  await approveToken(wallet, Config.ContractsAddress.USDC, Config.ContractsAddress.R2USD, amount);
  
  const usdcContract = new ethers.Contract(Config.ContractsAddress.USDC, Config.Abi.Erc20, wallet);
  const decimals = await usdcContract.decimals();
  const amountInWei = ethers.parseUnits(amount, decimals);
  
  const data = ethers.concat([
    Config.Router.buyMethodId,
    ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'], [wallet.address, amountInWei, 0, 0, 0, 0, 0])
  ]);

  log.step('Executing buy transaction...');
  const tx = await wallet.sendTransaction({ to: Config.ContractsAddress.R2USD, data, gasLimit: Config.gasSettings.gasLimit });
  const receipt = await tx.wait();
  log.success(`Transaction confirmed in block ${receipt.blockNumber}`);
}

async function sellR2usdToUsdc(wallet, amount) {
    await ensureSufficientBalance(wallet, Config.ContractsAddress.R2USD, amount, 'sellR2usdToUsdc');
    await approveToken(wallet, Config.ContractsAddress.R2USD, Config.Router.swapAddress, amount);

    const r2usdContract = new ethers.Contract(Config.ContractsAddress.R2USD, Config.Abi.Erc20, wallet);
    const decimals = await r2usdContract.decimals();
    const amountInWei = ethers.parseUnits(amount, decimals);
    const minOutput = amountInWei * 97n / 100n; // Slippage 3%

    const data = ethers.concat([
        Config.Router.sellMethodId,
        ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256', 'uint256', 'uint256'], [0n, 1n, amountInWei, minOutput])
    ]);
    
    log.step('Executing sell transaction...');
    const tx = await wallet.sendTransaction({ to: Config.Router.swapAddress, data, gasLimit: Config.gasSettings.gasLimit });
    const receipt = await tx.wait();
    log.success(`Transaction confirmed in block ${receipt.blockNumber}`);
}

async function swapR2usdToR2(wallet, amount) {
    await ensureSufficientBalance(wallet, Config.ContractsAddress.R2USD, amount, 'swapR2ToR2usd');
    await approveToken(wallet, Config.ContractsAddress.R2USD, Config.Router.stakingAddress, amount);
    
    const router = new ethers.Contract(Config.Router.stakingAddress, Config.Abi.Swap, wallet);
    const r2usdToken = new ethers.Contract(Config.ContractsAddress.R2USD, Config.Abi.Erc20, wallet);
    const r2usdDecimals = await r2usdToken.decimals();
    const amountInWei = ethers.parseUnits(amount, r2usdDecimals);
    
    log.step('Executing swap R2USD -> R2...');
    const tx = await router.swapExactTokensForTokens(
        amountInWei, 0, [Config.ContractsAddress.R2USD, Config.ContractsAddress.R2],
        wallet.address, Math.floor(Date.now() / 1000) + 1200, { gasLimit: Config.gasSettings.gasLimit }
    );
    const receipt = await tx.wait();
    log.success(`Transaction confirmed in block ${receipt.blockNumber}`);
}

async function swapR2ToR2usd(wallet, amount) {
    await ensureSufficientBalance(wallet, Config.ContractsAddress.R2, amount, 'swapR2ToR2usd');
    await approveToken(wallet, Config.ContractsAddress.R2, Config.Router.stakingAddress, amount);
    
    const router = new ethers.Contract(Config.Router.stakingAddress, Config.Abi.Swap, wallet);
    const r2Token = new ethers.Contract(Config.ContractsAddress.R2, Config.Abi.Erc20, wallet);
    const r2Decimals = await r2Token.decimals();
    const amountInWei = ethers.parseUnits(amount, r2Decimals);
    
    log.step('Executing swap R2 -> R2USD...');
    const tx = await router.swapExactTokensForTokens(
        amountInWei, 0, [Config.ContractsAddress.R2, Config.ContractsAddress.R2USD],
        wallet.address, Math.floor(Date.now() / 1000) + 1200, { gasLimit: Config.gasSettings.gasLimit }
    );
    const receipt = await tx.wait();
    log.success(`Transaction confirmed in block ${receipt.blockNumber}`);
}

async function stakewBtc(wallet, amount) {
    await ensureSufficientBalance(wallet, Config.ContractsAddress.wBTC, amount, 'stakewBtc');
    await approveToken(wallet, Config.ContractsAddress.wBTC, Config.Router.stakewBtc, amount);

    const stakingContract = new ethers.Contract(Config.Router.stakewBtc, Config.Abi.Staking, wallet);
    const wbtcToken = new ethers.Contract(Config.ContractsAddress.wBTC, Config.Abi.Erc20, wallet);
    const decimals = await wbtcToken.decimals();
    const amountInWei = ethers.parseUnits(amount, decimals);

    log.step('Executing wBTC staking...');
    const tx = await stakingContract.stake(Config.ContractsAddress.wBTC, amountInWei, { gasLimit: Config.gasSettings.gasLimit });
    const receipt = await tx.wait();
    log.success(`Transaction confirmed in block ${receipt.blockNumber}`);
}

async function stakeR2USD(wallet, amount) {
    await ensureSufficientBalance(wallet, Config.ContractsAddress.R2USD, amount, 'stakeR2USD');
    
    const r2usdContract = new ethers.Contract(Config.ContractsAddress.R2USD, Config.Abi.Erc20, wallet);
    const decimals = await r2usdContract.decimals();
    const amountInWei = ethers.parseUnits(amount.toString(), decimals);
    
    const currentAllowance = await r2usdContract.allowance(
        wallet.address, 
        Config.ContractsAddress.sR2USD
    );
    
    if (currentAllowance < amountInWei) {
        const approved = await approveToken(
            wallet,
            Config.ContractsAddress.R2USD,
            Config.ContractsAddress.sR2USD,
            amount
        );
        if (!approved) return false;
    }

    log.step('Attempting staking with method ID...');
    const data = Config.Router.stakingMethodId + 
               BigInt(amountInWei).toString(16).padStart(64, '0') + 
               '0'.repeat(576);
    
    const tx = {
        to: Config.ContractsAddress.sR2USD,
        data: data,
        gasLimit: Config.gasSettings.gasLimit
    };
    
    try {
        log.step(`Initiating staking: ${amount} R2USD to sR2USD`);
        const signedTx = await wallet.sendTransaction(tx);
        log.tx(`Transaction sent: ${signedTx.hash}`);
        log.explorer(`${Config.Network.explorer}/tx/${signedTx.hash}`);
        
        log.loading('Waiting for staking confirmation...');
        const receipt = await signedTx.wait();
        
        if (receipt.status === 0) {
            throw new Error('Transaction reverted');
        }
        
        log.success('Staking successful with method ID');
    } catch (error) {
        log.warn(`Failed with method ID: ${error.message}`);
        log.step('Attempting staking with ABI method...');
        const stakeContract = new ethers.Contract(
            Config.ContractsAddress.sR2USD, 
            Config.Abi.Staking, 
            wallet
        );
        
        const tx = await stakeContract.stake(
            Config.ContractsAddress.R2USD,
            amountInWei,
            {
                gasLimit: Config.gasSettings.gasLimit
            }
        );
        
        log.tx(`Fallback transaction sent: ${tx.hash}`);
        log.explorer(`${Config.Network.explorer}/tx/${tx.hash}`);
        
        log.loading('Waiting for transaction confirmation...');
        const receipt = await tx.wait();
        if (receipt.status === 0) {
            throw new Error('Fallback transaction reverted');
        }
        
        log.success('Staking successful with ABI method');
    }
    
    const newR2USDBalance = await checkBalance(wallet, Config.ContractsAddress.R2USD);
    const newSR2USDBalance = await checkBalance(wallet, Config.ContractsAddress.sR2USD);
    
    log.info(`New R2USD balance: ${newR2USDBalance}`);
    log.info(`New sR2USD balance: ${newSR2USDBalance}`);
    
    return true;
}

async function addLiquidityUniswap(wallet, amountTokenA, tokenAInfo, tokenBInfo, pairAddress, routerAddress) {
    await ensureSufficientBalance(wallet, tokenAInfo.address, amountTokenA, 'addLiquidityUniswap');
    
    const tokenAContract = new ethers.Contract(tokenAInfo.address, Config.Abi.Erc20, wallet);
    const tokenBContract = new ethers.Contract(tokenBInfo.address, Config.Abi.Erc20, wallet);
    const pairContract = new ethers.Contract(pairAddress, Config.Abi.Pair, wallet);

    const [tokenADecimals, tokenBDecimals] = await Promise.all([tokenAContract.decimals(), tokenBContract.decimals()]);
    const [reserve0, reserve1] = await pairContract.getReserves();
    const token0 = await pairContract.token0();

    const isTokenAToken0 = token0.toLowerCase() === tokenAInfo.address.toLowerCase();
    const tokenAReserve = isTokenAToken0 ? reserve0 : reserve1;
    const tokenBReserve = isTokenAToken0 ? reserve1 : reserve0;

    const ratio = tokenAReserve > 0n ? (Number(ethers.formatUnits(tokenBReserve, tokenBDecimals)) / Number(ethers.formatUnits(tokenAReserve, tokenADecimals))) : 0;
    const amountBString = ratio > 0 ? (ratio * Number(amountTokenA)).toFixed(Number(tokenBDecimals)) : "0";
    
    log.info(`Pool ratio: 1 ${tokenAInfo.symbol} = ${ratio.toFixed(6)} ${tokenBInfo.symbol}. Required ${tokenBInfo.symbol}: ${amountBString}`);
    await ensureSufficientBalance(wallet, tokenBInfo.address, amountBString, 'addLiquidityUniswap');
    
    await approveToken(wallet, tokenAInfo.address, routerAddress, amountTokenA);
    await approveToken(wallet, tokenBInfo.address, routerAddress, amountBString);

    const router = new ethers.Contract(routerAddress, Config.Abi.Pool, wallet);
    const tx = await router.addLiquidity(
        tokenAInfo.address, tokenBInfo.address,
        ethers.parseUnits(amountTokenA, tokenADecimals), ethers.parseUnits(amountBString, tokenBDecimals),
        0, 0, wallet.address, Math.floor(Date.now() / 1000) + 1200,
        { gasLimit: Config.gasSettings.gasLimit }
    );
    const receipt = await tx.wait();
    log.success(`Transaction confirmed in block ${receipt.blockNumber}`);
}

async function addLiquidityCurve(wallet, amountA, amountB, tokenAInfo, tokenBInfo, poolAddress) {
    await ensureSufficientBalance(wallet, tokenAInfo.address, amountA, 'addLiquidityCurve');
    await ensureSufficientBalance(wallet, tokenBInfo.address, amountB, 'addLiquidityCurve');

    await approveToken(wallet, tokenAInfo.address, poolAddress, amountA);
    await approveToken(wallet, tokenBInfo.address, poolAddress, amountB);
    
    const pool = new ethers.Contract(poolAddress, Config.Abi.CurvePool, wallet);
    const tokenA = new ethers.Contract(tokenAInfo.address, Config.Abi.Erc20, wallet);
    const tokenB = new ethers.Contract(tokenBInfo.address, Config.Abi.Erc20, wallet);
    const [decA, decB] = await Promise.all([tokenA.decimals(), tokenB.decimals()]);

    const amountsInWei = [ethers.parseUnits(amountA, decA), ethers.parseUnits(amountB, decB)];
    
    log.step('Executing add liquidity to Curve pool...');
    const tx = await pool.add_liquidity(amountsInWei, 0, wallet.address, { gasLimit: Config.gasSettings.gasLimit });
    const receipt = await tx.wait();
    log.success(`Transaction confirmed in block ${receipt.blockNumber}`);
}

async function main() {
    delete require.cache[require.resolve('./amount.json')];
    amounts = require('./amount.json');
    const privateKeys = process.env.PRIVATE_KEY?.split(',').map(key => key.trim()).filter(key => key) || [];

    if (privateKeys.length === 0) {
        log.error('Please set PRIVATE_KEY in your .env file, or run the script again to configure it.');
        return;
    }

    log.info(`Found ${privateKeys.length} private keys to process.`);

    for (const [index, privateKey] of privateKeys.entries()) {
        try {
            log.info(`==========================================================================`);
            log.info(`  PROCESSING WALLET ${index + 1} of ${privateKeys.length} | @airdropalc   `);
            log.info(`==========================================================================`);
            console.log('\n');
            const wallet = await initializeWallet(privateKey);
            operationResults[wallet.address] = {};

            const operations = [
                { name: 'buyUsdcToR2usd', enabled: parseFloat(amounts.buyUsdcToR2usd) > 0, func: buyUsdcToR2usd, params: [wallet, amounts.buyUsdcToR2usd] },
                { name: 'sellR2usdToUsdc', enabled: parseFloat(amounts.sellR2usdToUsdc) > 0, func: sellR2usdToUsdc, params: [wallet, amounts.sellR2usdToUsdc] },
                
                { name: 'swapR2usdToR2', enabled: parseFloat(amounts.swapR2usdToR2) > 0, func: swapR2usdToR2, params: [wallet, amounts.swapR2usdToR2] },
                { name: 'swapR2ToR2usd', enabled: parseFloat(amounts.swapR2ToR2usd) > 0, func: swapR2ToR2usd, params: [wallet, amounts.swapR2ToR2usd] },
                
                { name: 'stakewBtc', enabled: parseFloat(amounts.stakewBtc) > 0, func: stakewBtc, params: [wallet, amounts.stakewBtc] },
                { name: 'stakeR2USD', enabled: parseFloat(amounts.stakeR2USD) > 0, func: stakeR2USD, params: [wallet, amounts.stakeR2USD] },
                { name: 'addLiquidityR2Usdc', enabled: parseFloat(amounts.addLiquidityR2Usdc) > 0, func: addLiquidityUniswap, params: [wallet, amounts.addLiquidityR2Usdc, { address: Config.ContractsAddress.R2, symbol: 'R2' }, { address: Config.ContractsAddress.USDC, symbol: 'USDC' }, Config.ContractsAddress.pair_R2_USDC, Config.ContractsAddress.uniswapRouter] },
                { name: 'addLiquidityR2R2usd', enabled: parseFloat(amounts.addLiquidityR2R2usd) > 0, func: addLiquidityUniswap, params: [wallet, amounts.addLiquidityR2R2usd, { address: Config.ContractsAddress.R2, symbol: 'R2' }, { address: Config.ContractsAddress.R2USD, symbol: 'R2USD' }, Config.ContractsAddress.pair_R2_R2USD, Config.ContractsAddress.uniswapRouter] },
                { name: 'addLiquidity_R2USD_USDC', enabled: parseFloat(amounts.addLiquidity_R2USD_USDC?.R2USD) > 0, func: addLiquidityCurve, params: [wallet, amounts.addLiquidity_R2USD_USDC.R2USD, amounts.addLiquidity_R2USD_USDC.USDC, { address: Config.ContractsAddress.R2USD, symbol: 'R2USD' }, { address: Config.ContractsAddress.USDC, symbol: 'USDC' }, Config.ContractsAddress.pool_R2USD_USDC] },
                { name: 'addLiquidity_sR2USD_R2USD', enabled: parseFloat(amounts.addLiquidity_sR2USD_R2USD?.sR2USD) > 0, func: addLiquidityCurve, params: [wallet, amounts.addLiquidity_sR2USD_R2USD.sR2USD, amounts.addLiquidity_sR2USD_R2USD.R2USD, { address: Config.ContractsAddress.sR2USD, symbol: 'sR2USD' }, { address: Config.ContractsAddress.R2USD, symbol: 'R2USD' }, Config.ContractsAddress.pool_sR2USD_R2USD] },
            ];

            for (const op of operations) {
                if (op.enabled) {
                    try {
                        const loopCount = getLoopCount(op.name);
                        log.info(`==========================================================================`);
                        log.info(`           Starting Operation: ${op.name} (Loops: ${loopCount})           `);
                        log.info(`==========================================================================`);
                        console.log('\n')
                        for (let i = 0; i < loopCount; i++) {
                            log.info(`==========================================================================`);
                            log.info(`                        Loop ${i + 1}/${loopCount}                        `);
                            log.info(`==========================================================================`);
                            console.log('\n')
                            await executeWithRetry(op.func, op.name, op.params);
                            if (i < loopCount - 1) await randomDelay(3, 7);
                        }
                        operationResults[wallet.address][op.name] = { success: true };
                    } catch (error) {
                        log.error(`>> Operation ${op.name} FAILED for wallet ${wallet.address}: ${error.message}`);
                        operationResults[wallet.address][op.name] = { success: false, error: error.message };
                    }
                    await randomDelay();
                }
            }
        } catch (error) {
            log.error(`FATAL ERROR processing wallet ${index + 1}: ${error.message}`);
        }
    }

    displaySummary();
}

function displaySummary() {
    log.info('\n========================\n=== OPERATION SUMMARY ===\n========================');
    for (const [address, results] of Object.entries(operationResults)) {
        log.info(`\nWallet: ${address}`);
        for (const [opName, result] of Object.entries(results)) {
            const status = result.success ? '✅ Success' : '❌ Failed';
            const errorMsg = result.error ? `(Error: ${result.error.slice(0, 100)}...)` : '';
            log.info(`${opName.padEnd(28)} | ${status} ${errorMsg}`);
        }
    }
}

async function runAndSchedule() {
    try {
        await main();
    } catch (error) {
        log.error(`Error during execution: ${error.message}`);
    } finally {
        const nextRun = new Date(Date.now() + HOURS_24);
        log.info(`\nNext execution scheduled for: ${nextRun.toLocaleString()}`);
        setTimeout(runAndSchedule, HOURS_24);
    }
}

if (require.main === module) {
    (async () => {
        try {
            await checkAndSetupConfiguration();
            
            // Reload dotenv to capture any changes made during setup
            require('dotenv').config({ override: true });
            
            const runMode = process.env.RUN_MODE || 'once';

            if (runMode === 'daily') {
                log.info("Starting in daily schedule mode.");
                await runAndSchedule();
            } else {
                log.info("Starting in one-time run mode.");
                await main();
                log.info("One-time execution finished.");
            }

        } catch (error) {
            log.error(`Initial execution failed: ${error.message}`);
        }
    })();
}