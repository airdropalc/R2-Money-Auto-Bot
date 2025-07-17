const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
};

const scriptInfo = (scriptName, creator) => {
    const boxWidth = 45;
    const nameLine = `Script: ${scriptName}`;
    const creatorLine = `Created by: ${creator}`;
    const centeredName = nameLine.padStart(nameLine.length + Math.floor((boxWidth - nameLine.length) / 2), ' ').padEnd(boxWidth, ' ');
    const centeredCreator = creatorLine.padStart(creatorLine.length + Math.floor((boxWidth - creatorLine.length) / 2), ' ').padEnd(boxWidth, ' ');
    
    console.log(`\n${colors.bright}${colors.green}╔═════════════════════════════════════════════╗`);
    console.log(`║ ${centeredName} ║`);
    console.log(`║ ${centeredCreator} ║`);
    console.log(`╚═════════════════════════════════════════════╝${colors.reset}\n`);
};

module.exports = scriptInfo;