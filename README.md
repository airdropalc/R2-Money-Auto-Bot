# 🤖 R2 Money Interactive Auto-Bot (V2)

Welcome to the enhanced V2 of the R2 Money Bot! This version introduces an **interactive command-line interface (CLI)** for a more user-friendly and flexible setup, designed for seamless interaction with the R2 Money Testnet.

<a href="https://r2.money?code=MUYFN" target="_blank"><img src="https://img.cryptorank.io/coins/r_21745247658866.png" alt="DZAP Registration Banner"></a>

code : **MUYFN**
This script is an optimization of the previous version, which you can find here:
* [R2 Money Bot Version 1.1.0](https://github.com/airdropalc/R2-Money-Bot)


[![Telegram](https://img.shields.io/badge/Community-Airdrop_ALC-26A5E4?style=for-the-badge&logo=telegram)](https://t.me/airdropalc/2127)

---

## ✨ Enhanced Features & Capabilities

This version moves beyond static configuration files to a dynamic, interactive setup process with powerful new features.

* **🗣️ Interactive CLI Setup:** No more manually editing JSON files for amounts or loops. The bot will ask you exactly what you want to do, how much to use, and how often to do it.
* **🗓️ Flexible Execution Modes:** You choose how the bot runs:
    * **Run Once:** Execute all your selected tasks a single time.
    * **Run Daily:** Automatically set up a cron job to perform the tasks every day.
* **👥 Multi-Wallet Support:** Easily manage multiple wallets by providing their private keys in the configuration.
* **🌐 Optional Proxy Integration:** Supports the use of proxies for enhanced privacy and to avoid potential rate-limiting.
* ** DeFi Operations:** The interactive setup allows you to configure a variety of on-chain actions:
    * **Swap:** USDC **»** R2USD
    * **Swap:** R2USD **»** USDC
    * **Stake:** WBTC for R2BTC
    * **Stake:** R2USD for sR2USD

---

## 🛠️ Installation & Configuration Guide

Follow these steps to get the bot running. The main setup happens when you run the script itself.

### 1. Clone the Repository
First, download the project files to your machine and navigate into the directory.
```bash
git clone https://github.com/airdropalc/R2-Money-Auto-Bot.git
cd R2-Money-Auto-Bot
```

### 2. Install Dependencies
Install the required Node.js packages using `npm`.
```bash
npm install
```
### 3. Run the Interactive Setup
This is where the magic happens. Start the bot and simply answer the questions it asks you in the terminal.
```bash
node index.js
```
The script will guide you through selecting which actions to perform (swap, stake), the amounts to use, and whether to run the tasks once or on a daily schedule.

---

## ⚠️ Important Security Disclaimer

**This software is provided for educational purposes only. Use it wisely and entirely at your own risk.**

* **Handle Your Private Keys With Extreme Care:** The `.env` file contains your private keys, which grant **complete and irreversible control** over your funds.
* **NEVER share your private keys** or commit your `.env` file to a public GitHub repository.
* The authors and contributors of this project are **not responsible for any form of financial loss**, account compromise, or other damages. The security of your assets is **your responsibility**.

---
> Inspired by and developed for the [Airdrop ALC](https://t.me/airdropalc) community.

## License

![Version](https://img.shields.io/badge/version-1.1.0-blue)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)]()

---
