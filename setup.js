const readline = require('readline');
const fs = require('fs');
const log = require('./config/logger');
const scriptInfo = require('./config/banner');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function checkAndSetupConfiguration() {
    scriptInfo('R2 Money Auto Bot', '@airdropalc');
    let needsSetup = false;

    if (!fs.existsSync('.env')) {
        log.warn(".env file not found. Starting configuration mode.");
        needsSetup = true;
    } else {
        const answer = await question("Configuration file already exists. Do you want to reconfigure? (y/n): ");
        if (answer.toLowerCase() === 'y') {
            needsSetup = true;
        } else {
            log.success("Using existing configuration.");
        }
    }

    if (needsSetup) {
        await configureEnv();
        await configureProxy();
        await configureOperations();
        await configureSchedule();
    }

    rl.close();
}

async function configureEnv() {
    log.step("1. PRIVATE KEY CONFIGURATION");
    const privateKeys = await question("   -> Enter your PRIVATE_KEY(s) (pk1,pk2,pk3,etc.): ");
    
    if (!privateKeys || privateKeys.trim() === '') {
        log.error("PRIVATE_KEY cannot be empty. Aborting.");
        process.exit(1);
    }

    // Initialize .env with the private key
    fs.writeFileSync('.env', `PRIVATE_KEY=${privateKeys.trim()}\n`);
    log.success("Successfully saved PRIVATE_KEY.");
}

async function configureProxy() {
    log.step("2. PROXY CONFIGURATION");
    const useProxies = await question("   -> Do you want to use proxies? (y/n): ");

    if (useProxies.toLowerCase() !== 'y') {
        log.info("   -> Skipping proxy configuration.");
        if (fs.existsSync('proxy.txt')) {
            fs.writeFileSync('proxy.txt', ''); 
        }
        return;
    }

    const proxies = [];
    log.info("   -> Enter your proxies one by one (format: user:pass@ip:port). Press Enter on an empty line to finish.");
    
    while (true) {
        const proxyInput = await question(`   > Proxy: `);
        if (proxyInput.trim() === '') {
            break;
        }
        proxies.push(proxyInput.trim());
    }

    if (proxies.length > 0) {
        fs.writeFileSync('proxy.txt', proxies.join('\n') + '\n');
        log.success(`   -> Successfully saved ${proxies.length} proxies to proxy.txt.`);
    } else {
        log.warn("   -> No proxies were added.");
        if (fs.existsSync('proxy.txt')) {
            fs.writeFileSync('proxy.txt', '');
        }
    }
}

async function configureOperations() {
    log.step("3. OPERATIONS CONFIGURATION");

    const amounts = JSON.parse(fs.readFileSync('amount.json', 'utf-8'));
    const loops = JSON.parse(fs.readFileSync('loop.json', 'utf-8'));

    // Helper to ask for amount and loop
    const ask = async (key, name, currentAmount, currentLoop, askLoop = true) => {
        const amount = await question(`   -> Enter amount for ${name} (current: ${currentAmount}): `);
        amounts[key] = (amount.trim() !== '' && !isNaN(amount)) ? amount.trim() : currentAmount;

        if (askLoop) {
            const loop = await question(`      Enter number of loops for ${name} (current: ${currentLoop}): `);
            loops[key] = (loop.trim() !== '' && !isNaN(loop)) ? parseInt(loop.trim(), 10) : currentLoop;
        }
    };
    
    log.info("-> Swap USDC » R2USD");
    await ask('buyUsdcToR2usd', 'USDC to R2USD Swap', amounts.buyUsdcToR2usd, loops.buyUsdcToR2usd);

    log.info("-> Swap R2USD » USDC");
    await ask('sellR2usdToUsdc', 'R2USD to USDC Swap', amounts.sellR2usdToUsdc, loops.sellR2usdToUsdc);

    log.info("-> Stake wBTC » R2wBTC");
    await ask('stakewBtc', 'wBTC Stake', amounts.stakewBtc, loops.stakewBtc, false);

    log.info("-> Stake R2USD » sR2USD");
    await ask('stakeR2USD', 'R2USD Stake', amounts.stakeR2USD, loops.stakeR2USD, false);

    // Reset liquidity pools as requested
    amounts.addLiquidityR2Usdc = "0";
    amounts.addLiquidityR2R2usd = "0";
    amounts.addLiquidity_R2USD_USDC = { R2USD: "0", USDC: "0" };
    amounts.addLiquidity_sR2USD_R2USD = { sR2USD: "0", R2USD: "0" };

    fs.writeFileSync('amount.json', JSON.stringify(amounts, null, 2));
    fs.writeFileSync('loop.json', JSON.stringify(loops, null, 2));

    log.success("Successfully updated amount.json and loop.json.");
}

async function configureSchedule() {
    log.step("4. SCHEDULING CONFIGURATION");
    const answer = await question("   -> Run script every days? (y/n, 'n' for one-time run): ");
    const runMode = answer.toLowerCase() === 'y' ? 'daily' : 'once';

    fs.appendFileSync('.env', `RUN_MODE=${runMode}\n`);
    log.success(`Script is configured to run ${runMode}.`);
}

module.exports = { checkAndSetupConfiguration };