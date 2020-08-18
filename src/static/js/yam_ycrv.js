$(function() {
    consoleInit();
    start(main);
});

async function main() {
    const App = await init_ethers();

    const stakingToken = YCRV_TOKEN_ADDR;
    const stakingTokenTicker = "YCRV";
    const rewardPoolAddr = YCRV_YAM_CLASSIC_REWARD_POOL_ADDR;
    const rewardTokenAddr = YAM_CLASSIC_TOKEN_ADDR; // yam2
    const rewardTokenTicker = "YAM Classic";
    const REBASER_INSTANCE = new ethers.Contract(REBASER_ADDR, REBASER_ABI, App.provider);


    _print(`Initialized ${App.YOUR_ADDRESS}`);
    _print("Reading smart contracts...\n");
    _print(`${rewardTokenTicker} Address: ${rewardTokenAddr}`);
    _print(`Reward Pool Address: ${rewardPoolAddr}\n`);

    const REWARD_POOL = new ethers.Contract(rewardPoolAddr, YFFI_REWARD_CONTRACT_ABI, App.provider);
    const CURVE_Y_POOL = new ethers.Contract(CURVE_Y_POOL_ADDR, CURVE_Y_POOL_ABI, App.provider);
    const STAKING_TOKEN = new ethers.Contract(stakingToken, ERC20_ABI, App.provider);

    const YCRV_TOKEN = new ethers.Contract(YCRV_TOKEN_ADDR, ERC20_ABI, App.provider);
    const YAM_TOKEN = new ethers.Contract(YAM_CLASSIC_TOKEN_ADDR, YAM_TOKEN_ABI, App.provider);

    const yamScale = await YAM_TOKEN.yamsScalingFactor() / 1e18;

    const stakedYAmount = await REWARD_POOL.balanceOf(App.YOUR_ADDRESS) / 1e18;
    const earnedYFFI = yamScale * await REWARD_POOL.earned(App.YOUR_ADDRESS) / 1e18;
    const totalSupplyOfStakingToken = await STAKING_TOKEN.totalSupply() / 1e18;
    const totalStakedYAmount = await STAKING_TOKEN.balanceOf(rewardPoolAddr) / 1e18;

    // Find out reward rate
    const weekly_reward = (await get_synth_weekly_rewards(REWARD_POOL)) * await YAM_TOKEN.yamsScalingFactor() / 1e18;
    const nextHalving = await getPeriodFinishForReward(REWARD_POOL);

    const startTime = await REWARD_POOL.starttime();
    const timeUntil = startTime - (Date.now() / 1000);

    const rewardPerToken = weekly_reward / totalStakedYAmount;

    // Find out underlying assets of Y
    const YVirtualPrice = await CURVE_Y_POOL.get_virtual_price() / 1e18;
    const unstakedY = await STAKING_TOKEN.balanceOf(App.YOUR_ADDRESS) / 1e18;

    _print("Finished reading smart contracts... Looking up prices... \n")

    // Look up prices
    const prices = await lookUpPrices(["curve-fi-ydai-yusdc-yusdt-ytusd"]);
    const stakingTokenPrice = prices["curve-fi-ydai-yusdc-yusdt-ytusd"].usd;

    const rewardTokenPrice = await getCurrentPrice(REBASER_INSTANCE)

    // Finished. Start printing

    _print("========== PRICES ==========")
    _print(`1 ${rewardTokenTicker}    = $${rewardTokenPrice}`);
    _print(`1 yCRV   = $${YVirtualPrice}`);
    _print(`1 ${stakingTokenTicker}  = $${stakingTokenPrice}\n`);

    _print("========== STAKING =========")
    _print(`There are total   : ${totalSupplyOfStakingToken} ${stakingTokenTicker}.`);
    _print(`There are total   : ${totalStakedYAmount} ${stakingTokenTicker} staked in ${rewardTokenTicker}'s ${stakingTokenTicker} staking pool.`);
    _print(`                  = ${toDollar(totalStakedYAmount * stakingTokenPrice)}\n`);
    _print(`You are staking   : ${stakedYAmount} ${stakingTokenTicker} (${toFixed(stakedYAmount * 100 / totalStakedYAmount, 3)}% of the pool)`);
    _print(`                  = ${toDollar(stakedYAmount * stakingTokenPrice)}\n`);


    if (timeUntil > 0) {
        _print_bold(`Reward starts in ${forHumans(timeUntil)}\n`);
    }

    // REWARDS
    _print(`======== ${rewardTokenTicker} REWARDS ========`)
    // _print(" (Temporarily paused until further emission model is voted by the community) ");
    _print(`Claimable Rewards : ${toFixed(earnedYFFI, 4)} ${rewardTokenTicker} = $${toFixed(earnedYFFI * rewardTokenPrice, 2)}`);
    const YFFIWeeklyEstimate = rewardPerToken * stakedYAmount;

    _print(`Hourly estimate   : ${toFixed(YFFIWeeklyEstimate / (24 * 7), 4)} ${rewardTokenTicker} = ${toDollar((YFFIWeeklyEstimate / (24 * 7)) * rewardTokenPrice)} (out of total ${toFixed(weekly_reward / (7 * 24), 2)} ${rewardTokenTicker})`)
    _print(`Daily estimate    : ${toFixed(YFFIWeeklyEstimate / 7, 2)} ${rewardTokenTicker} = ${toDollar((YFFIWeeklyEstimate / 7) * rewardTokenPrice)} (out of total ${toFixed(weekly_reward / 7, 2)} ${rewardTokenTicker})`)
    _print(`Weekly estimate   : ${toFixed(YFFIWeeklyEstimate, 2)} ${rewardTokenTicker} = ${toDollar(YFFIWeeklyEstimate * rewardTokenPrice)} (out of total ${weekly_reward} ${rewardTokenTicker})`)
    const YFIWeeklyROI = (rewardPerToken * rewardTokenPrice) * 100 / (stakingTokenPrice);

    _print(`\nHourly ROI in USD : ${toFixed((YFIWeeklyROI / 7) / 24, 4)}%`)
    _print(`Daily ROI in USD  : ${toFixed(YFIWeeklyROI / 7, 4)}%`)
    _print(`Weekly ROI in USD : ${toFixed(YFIWeeklyROI, 4)}%`)
    _print(`APY (unstable)    : ${toFixed(YFIWeeklyROI * 52, 4)}% \n`)

    const timeTilHalving = nextHalving - (Date.now() / 1000);

    _print(`Reward ending      : in ${forHumans(timeTilHalving)} \n`);

    const resetApprove = async function() {
       return rewardsContract_resetApprove(stakingToken, rewardPoolAddr, App);
    };

    const approveTENDAndStake = async function () {
        return rewardsContract_stake(stakingToken, rewardPoolAddr, App);
    };

    const unstake = async function() {
        return rewardsContract_unstake(rewardPoolAddr, App);
    };

    const claim = async function() {
        return rewardsContract_claim(rewardPoolAddr, App);
    };

    const exit = async function() {
        return rewardsContract_exit(rewardPoolAddr, App);
    };

    _print_link(`Reset approval to 0`, resetApprove);
    _print_link(`Stake ${unstakedY} ${stakingTokenTicker}`, approveTENDAndStake);
    _print_link(`Unstake ${stakedYAmount} ${stakingTokenTicker}`, unstake);
    _print_link(`Claim ${earnedYFFI} ${rewardTokenTicker}`, claim);
    _print_link(`Exit`, exit);

  hideLoading();


}
