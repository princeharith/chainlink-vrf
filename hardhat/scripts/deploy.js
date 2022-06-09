const { ethers } = require("hardhat");
require("dotenv").config({ path: ".env" });
require("@nomiclabs/hardhat-etherscan");
const { FEE, VRF_COORDINATOR, LINK_TOKEN, KEY_HASH } = require("../constants");

async function main() {
    const randomWinnerGame = await ethers.getContractFactory("RandomWinnerGame");
    const deployedContract = await randomWinnerGame.deploy(VRF_COORDINATOR, LINK_TOKEN, FEE, KEY_HASH);

    await deployedContract.deployed();

    console.log("The contract has been deployed to: ", deployedContract.address);

    console.log("Waiting for etherscan to notice contract has been deployed...");
    await sleep(30000);

    await hre.run("verify:verify", {
        address: deployedContract.address,
        constructorArguments: [VRF_COORDINATOR, LINK_TOKEN, FEE, KEY_HASH],
    });
}

function sleep(ms){
    return new Promise((resolve => setTimeout(resolve, ms)));
}

main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});
