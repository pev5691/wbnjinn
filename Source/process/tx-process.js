/*
 * @project: TERA
 * @version: Development (beta)
 * @license: MIT (not for evil)
 * @copyright: Yuriy Ivanov (Vtools) 2017-2020 [progr76@gmail.com]
 * Web: https://terafoundation.org
 * Twitter: https://twitter.com/terafoundation
 * Telegram:  https://t.me/terafoundation
*/


global.PROCESS_NAME = "TX";

const crypto = require('crypto');
const fs = require('fs');

require("../core/constant");
global.DATA_PATH = GetNormalPathString(global.DATA_PATH);
global.CODE_PATH = GetNormalPathString(global.CODE_PATH);
require("../core/library");



global.READ_ONLY_DB = 0;
require("../system");

require("./child-process");

process.on('message', function (msg)
{
    switch(msg.cmd)
    {
        case "FindTX":
            global.TreeFindTX.SaveValue(msg.TX, msg);
            break;
        case "SetSmartEvent":
            global.TreeFindTX.SaveValue("Smart:" + msg.Smart, 1);
            break;
            
        default:
            break;
    }
}
);

setInterval(PrepareStatEverySecond, 1000);

global.SetStatMode = function (Val)
{
    global.STAT_MODE = Val;
    return global.STAT_MODE;
}

global.TreeFindTX = new STreeBuffer(30 * 1000, CompareItemHashSimple, "string");



var JinnLib = require("../jinn/tera");
var Map = {"Block":1, "BlockDB":1, "Log":1, };
JinnLib.Create(Map);

global.bShowDetail = 0;
global.StopTxProcess = 0;


global.ClearDataBase = ClearDataBase;
function ClearDataBase()
{
    for(var key in DApps)
    {
        DApps[key].ClearDataBase();
    }
    
    if(global.Engine)
        global.Engine.DBResult.Clear();
    ToLogTx("Start num = 0", 2);
}

global.RewriteAllTransactions = RewriteAllTransactions;
function RewriteAllTransactions(bSilent)
{
    if(!bSilent)
        ToLogTx("*************RewriteAllTransactions");
    
    ClearDataBase();
    return 1;
}

global.ReWriteDAppTransactions = ReWriteDAppTransactions;
function ReWriteDAppTransactions(Params,bSilent)
{
    StopTxProcess = 0;
    
    var StartNum = Params.StartNum;
    if(!bSilent)
    {
        ToLogTx("ReWriteDAppTransactions from: " + StartNum);
    }
    else
    {
        ToLogTx("ReWriteDAppTransactions from: " + StartNum, 5);
    }
    
    while(1)
    {
        var LastBlockNum = DApps.Accounts.GetLastBlockNumAct();
        if(LastBlockNum <= 0)
        {
            ToLogTx("Find LastBlockNum=" + LastBlockNum);
            RewriteAllTransactions(1);
            return;
        }
        if(LastBlockNum >= StartNum)
        {
            BlockDeleteTX(LastBlockNum);
        }
        else
        {
            break;
        }
    }
}





class CTXProcess
{
    constructor()
    {
        
        var LastBlockNum = DApps.Accounts.GetLastBlockNumAct();
        
        var AccountLastNum = DApps.Accounts.DBState.GetMaxNum();
        if(LastBlockNum <= 0 && AccountLastNum > 16)
        {
            ToLogTx("Error Init CTXProcess: " + LastBlockNum + "  AccountLastNum=" + AccountLastNum)
            this.ErrorInit = 1
            
            this.RepairActRow()
            
            return;
        }
        
        ToLogTx("Init CTXProcess: " + LastBlockNum)
        
        if(LastBlockNum)
            ReWriteDAppTransactions({StartNum:LastBlockNum - 10}, 1)
        
        this.ErrorAccHash = 0
        this.TimeWait = 0
    }
    
    Run()
    {
        if(StopTxProcess)
            return;
        
        var StartTime = Date.now();
        if(this.TimeWait)
        {
            if(StartTime - this.TimeWait < 600)
                return;
        }
        this.TimeWait = 0
        if(this.ErrorAccHash >= 100)
        {
            ToLogTx("FORCE CalcMerkleTree")
            DApps.Accounts.CalcMerkleTree(1)
            this.ErrorAccHash = 0
            return;
        }
        
        for(var i = 0; i < 500; i++)
        {
            var Result = this.RunItem();
            if(!Result)
            {
                this.TimeWait = Date.now()
                return;
            }
            
            if(Date.now() - StartTime > 1000)
                return;
        }
    }
    
    RunItem()
    {
        
        var LastItem = DApps.Accounts.GetLastBlockNumItem();
        if(!LastItem)
        {
            if(SERVER.GetMaxNumBlockDB() < BLOCK_PROCESSING_LENGTH2)
                return 0;
            
            return this.DoBlock(1);
        }
        
        var PrevBlockNum = LastItem.BlockNum;
        var NextBlockNum = PrevBlockNum + 1;
        var Block = SERVER.ReadBlockHeaderDB(NextBlockNum);
        if(!Block)
            return 0;
        
        return this.DoBlock(NextBlockNum, Block.PrevSumHash, LastItem.HashData);
    }
    
    DoBlock(BlockNum, CheckSumHash, LastHashData)
    {
        var PrevBlockNum = BlockNum - 1;
        if(global.glStopTxProcessNum && BlockNum >= global.glStopTxProcessNum)
        {
            if(global.WasStopTxProcessNum !== BlockNum)
                ToLogTx("--------------------------------Stop TX AT NUM: " + BlockNum)
            global.WasStopTxProcessNum = BlockNum
            return 0;
        }
        
        if(BlockNum >= BLOCK_PROCESSING_LENGTH2 && PrevBlockNum)
        {
            if(!LastHashData)
            {
                ToLogTx("SumHash:!LastHashData : DeleteTX on Block=" + PrevBlockNum, 5)
                
                BlockDeleteTX(PrevBlockNum)
                return 0;
            }
            
            if(!IsEqArr(LastHashData.SumHash, CheckSumHash))
            {
                ToLogTx("SumHash:DeleteTX on Block=" + PrevBlockNum, 5)
                
                BlockDeleteTX(PrevBlockNum)
                return 0;
            }
            
            var AccHash = DApps.Accounts.GetCalcHash();
            if(!IsEqArr(LastHashData.AccHash, AccHash))
            {
                if(this.ErrorAccHash < 10)
                    ToLogTx("AccHash:DeleteTX on Block=" + PrevBlockNum + " GOT:" + GetHexFromArr(LastHashData.AccHash) + " NEED:" + GetHexFromArr(AccHash),
                    3)
                
                this.ErrorAccHash++
                BlockDeleteTX(PrevBlockNum)
                
                return  - 1;
            }
        }
        
        var Block = SERVER.ReadBlockDB(BlockNum);
        if(!Block)
            return 0;
        
        if(CheckSumHash && !IsEqArr(Block.PrevSumHash, CheckSumHash))
        {
            ToLogTx("DB was rewrited on Block=" + BlockNum, 2)
            return 0;
        }
        
        if(Block.BlockNum !== BlockNum)
        {
            ToLogOne("Error read block on " + BlockNum)
            return 0;
        }
        
        this.ErrorAccHash = 0
        
        if(BlockNum % 100000 === 0 || bShowDetail)
            ToLogTx("CALC: " + BlockNum)
        
        SERVER.BlockProcessTX(Block)
        
        return 1;
    }
    
    RepairActRow()
    {
        var DBAct;
        var MaxNum = DApps.Accounts.DBAct.GetMaxNum();
        if(MaxNum ===  - 1)
            DBAct = DApps.Accounts.DBActPrev
        else
            DBAct = DApps.Accounts.DBAct
        
        var MaxNum = DBAct.GetMaxNum();
        if(MaxNum ===  - 1)
            return;
        
        var Item = DBAct.Read(MaxNum);
        if(Item && !Item.BlockNum)
        {
            ToLogTx("Delete row at: " + MaxNum)
            DBAct.Truncate(MaxNum - 1)
        }
    }
};

function BlockDeleteTX(BlockNum)
{
    SERVER.BlockDeleteTX({BlockNum:BlockNum});
}

function CheckActDB()
{
    if(!SERVER)
        return;
    
    SERVER.Close();
    
    var MaxBlockNumDB = SERVER.GetMaxNumBlockDB();
    var DBAct = DApps.Accounts.DBAct;
    var MaxNum = DBAct.GetMaxNum();
    var Num = MaxNum - 100;
    if(Num < 0)
        Num = 0;
    var Item = DBAct.Read(Num);
    if(!Item)
        return;
    ToLogTx("Check " + Item.BlockNum, 5);
    while(1)
    {
        var Item = DBAct.Read(Num);
        if(!Item)
            return;
        
        if(Item.Mode === 200)
        {
            Item.HashData = DApps.Accounts.GetActHashesFromBuffer(Item.PrevValue.Data);
            if(Item)
            {
                if(Item.BlockNum > MaxBlockNumDB - 5)
                    break;
                
                var Block = SERVER.ReadBlockHeaderDB(Item.BlockNum);
                if(!Block)
                    return;
                if(!IsEqArr(Block.SumHash, Item.HashData.SumHash))
                {
                    ToLogTx("---CheckActDB: Error SumHash on BlockNum=" + Item.BlockNum, 4);
                    ReWriteDAppTransactions({StartNum:Item.BlockNum}, 1);
                    
                    return;
                }
            }
        }
        
        Num++;
    }
}



global.OnBadAccountHash = function (BlockNum,BlockNumHash)
{
    var MinBlockNum = SERVER.GetMaxNumBlockDB() - 10000;
    if(MinBlockNum < 0)
        MinBlockNum = 0;
    if(DApps.Accounts.BadBlockNumChecked < MinBlockNum)
        DApps.Accounts.BadBlockNumChecked = MinBlockNum;
    
    if(BlockNum > DApps.Accounts.BadBlockNumChecked)
    {
        if(DApps.Accounts.BadBlockNum < BlockNum)
            DApps.Accounts.BadBlockNum = BlockNum;
        if(!DApps.Accounts.BadBlockNumHash || BlockNumHash < DApps.Accounts.BadBlockNumHash)
        {
            DApps.Accounts.BadBlockNumHash = BlockNumHash;
            
            ToLog("****FIND BAD ACCOUNT HASH IN BLOCK: " + BlockNumHash + " DO BLOCK=" + BlockNum, 3);
        }
    }
}

function CheckBadsBlock()
{
    if(DApps.Accounts.BadBlockNumHash)
    {
        var StartRewrite = DApps.Accounts.BadBlockNumHash - global.PERIOD_ACCOUNT_HASH - 1;
        if(StartRewrite < 0)
            StartRewrite = 0;
        ToLogTx("---CheckBadsBlock: Rewrite tx from BlockNum=" + StartRewrite, 3);
        
        DApps.Accounts.BadBlockNumChecked = DApps.Accounts.BadBlockNum;
        DApps.Accounts.BadBlockNumHash = 0;
        
        DApps.Accounts.CalcMerkleTree(1);
        
        ReWriteDAppTransactions({StartNum:StartRewrite}, 1);
    }
}

var TxProcess = undefined;
setInterval(function ()
{
    if(!TxProcess)
    {
        TxProcess = new CTXProcess();
        if(TxProcess.ErrorInit)
        {
            TxProcess = undefined;
            return;
        }
    }
    
    if(SERVER)
    {
        SERVER.Close();
    }
    
    TxProcess.Run();
}
, 50);

setInterval(function ()
{
    CheckActDB();
    CheckBadsBlock();
}
, 60 * 1000);
