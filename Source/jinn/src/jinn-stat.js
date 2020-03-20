/*
 * @project: JINN
 * @version: 1.0
 * @license: MIT (not for evil)
 * @copyright: Yuriy Ivanov (Vtools) 2019-2020 [progr76@gmail.com]
 * Telegram:  https://t.me/progr76
*/


'use strict';

'use strict';
global.JINN_MODULES.push({DoNode:DoNode});

var StatKeys = {BlockTx:"BlockTx", TxSend:"Tx", TTSend:"Tt", HeaderSend:"Head", BodySend:"Body", BodyTxSend:"BodyTx", ReadDB:"Reads",
    LoadBody:"LoadB", LoadHeader:"LoadH", SaveBlock:"SaveH", SaveBody:"SaveB", MAXChainHeight:"Chains", MAXCacheBlockLength:"CacheD",
    MAXCacheBodyLength:"CacheB", MAXCacheLength:"-Cache", CacheErrDB:"CacheErr", FindHeadCount:"FHead", MAXFindHeadCount:"MFHead",
    FindEmptyCount:"FEmpty", MAXFindEmptyCount:"MFEmpty", HotCount:"Hots", MINHots:"MinHots", ActiveCount:"Connects", AddrCount:"Addrs",
    NoValidateTx:0, AddToTreeTx:"-AddTreeTx", WasSendOnAddTxToTree:0, NotAddTxToTree:0, ErrorCount:"NetErr", };
global.JINN_STAT = {};
JINN_STAT.Clear = function ()
{
    for(var key in StatKeys)
        JINN_STAT[key] = 0;
    
    JINN_STAT.AllTraffic = 0;
    JINN_STAT.MINHots =  - 1;
}
JINN_STAT.Clear();
global.GetJinnStatInfo = GetJinnStatInfo;
function GetJinnStatInfo(JinnStat)
{
    if(!JinnStat)
        JinnStat = JINN_STAT;
    
    var Traffic = (JinnStat.AllTraffic / 1024).toFixed(1);
    var Str = "Traffic:" + Traffic + " Kb";
    
    for(var key in StatKeys)
    {
        var Value = StatKeys[key];
        if(Value && Value.substr(0, 1) !== "-")
            Str += "\n" + Value + ":" + JinnStat[key];
    }
    
    return Str;
}

//Engine context
function DoNode(Engine)
{
    if(Engine.Del)
        return ;
    if(Engine.ROOT_NODE)
        return ;
    
    var BlockNum = JINN_EXTERN.GetCurrentBlockNumByTime() - JINN_CONST.STEP_LAST;
    if(Engine.StatLastCurBlockNum === BlockNum)
        return ;
    Engine.StatLastCurBlockNum = BlockNum;
    
    JINN_STAT.ActiveCount += Engine.ConnectArray.length;
    if(Engine.GetBlockDB)
    {
        var Block = Engine.GetBlockDB(BlockNum);
        Engine.CheckLoadBody(Block);
        if(Block && Block.TxData)
        {
            JINN_STAT.BlockTx += Block.TxData.length;
            JINN_STAT.MaxBlockTx = Math.max(Block.TxData.length);
        }
    }
    
    var CurHotCounts = 0;
    for(var n = 0; n < Engine.LevelArr.length; n++)
    {
        var Child = Engine.LevelArr[n];
        if(Child && Child.IsHot())
        {
            CurHotCounts++;
        }
    }
    JINN_STAT.HotCount += CurHotCounts;
    if(JINN_STAT.MINHots ===  - 1 || JINN_STAT.MINHots > CurHotCounts)
        JINN_STAT.MINHots = CurHotCounts;
    
    for(var l = 0; l < Engine.NodesArrByLevel.length; l++)
    {
        var LArr = Engine.NodesArrByLevel[l];
        if(LArr)
            JINN_STAT.AddrCount += LArr.length;
    }
}
