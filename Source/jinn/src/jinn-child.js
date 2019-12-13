/*
 * @project: TERA
 * @version: Development (beta)
 * @license: MIT (not for evil)
 * @copyright: Yuriy Ivanov (Vtools) 2017-2019 [progr76@gmail.com]
 * Web: https://terafoundation.org
 * Twitter: https://twitter.com/terafoundation
 * Telegram:  https://t.me/terafoundation
*/

global.JINN_MODULES.push({InitClass:InitClass, Name:"Child"});
const glHistoryChildKeys = {"ip":1, "port":1, "ID":1, "Del":1, "IDStr":1, "IDArr":1, "NodeHash":1};
function InitClass(Engine)
{
    Engine.NodeArray = [];
    Engine.NodeMap = {};
    Engine.RetChildByIPPort = function (ip,port,bInitAlways)
    {
        if(!port || typeof port !== "number")
            throw "RetChildByIPPort : Error port number = " + port;
        var HostName = String(ip) + ":" + port;
        var IDArr = sha3(HostName);
        var IDStr = GetHexFromArr(IDArr);
        return Engine.RetChild(IDStr, ip, port, bInitAlways);
    };
    Engine.FindChildByIPPort = function (ip,port)
    {
        var HostName = String(ip) + ":" + port;
        var IDArr = sha3(HostName);
        var IDStr = GetHexFromArr(IDArr);
        var Child = Engine.NodeMap[IDStr];
        return Child;
    };
    Engine.RetChild = function (IDStr,ip,port,bInitAlways)
    {
        var Child = Engine.NodeMap[IDStr];
        if(!Child)
        {
            Child = Engine.NewChild(GetArrFromHex(IDStr), ip, port);
        }
        else
            if(bInitAlways)
            {
                Engine.InitChild(Child, ip, port);
            }
        if(IDStr === Engine.IDStr)
        {
            Child.Self = 1;
            Child.Active = 0;
        }
        return Child;
    };
    Engine.NewChild = function (IDArr,ip,port)
    {
        if(!port || typeof port !== "number")
            throw "NewChild : Error port number = " + port;
        var IDStr = GetHexFromArr(IDArr);
        var Child = Engine.NodeMap[IDStr];
        if(!Child)
        {
            Child = {IDStr:IDStr, IDArr:IDArr};
            Engine.NodeMap[Child.IDStr] = Child;
            Engine.NodeArray.push(Child);
        }
        Engine.InitChild(Child, ip, port);
        return Child;
    };
    Engine.ResetChild = function (Child)
    {
        for(var key in Child)
        {
            if(glHistoryChildKeys[key])
                continue;
            if(typeof Child[key] !== "function")
                delete Child[key];
        }
        Child.Del = 1;
    };
    Engine.InitChild = function (Child,ip,port)
    {
        Child.ip = ip;
        Child.port = port;
        Child.LastTransferLider = 0;
        Child.ErrCount = 0;
        Child.IDContextNum = 0;
        Child.ContextCallMap = {};
        Child.SendAddrMap = {};
        Child.ReceiveDataArr = [];
        Child.ID = port % 1000;
        if(Engine.InitChildNext)
            Engine.InitChildNext(Child);
        Child.ToError = function (Str)
        {
            Engine.ToError(Child, Str);
        };
        Child.ToLog = function (Str)
        {
            ToLog("" + Engine.ID + "<-->" + Child.ID + ":  " + Str);
        };
        Child.ToDebug = function (Str)
        {
            if(global.DEBUG_ID !== "ALL")
                if(Engine.ID !== global.DEBUG_ID)
                    return ;
            Child.ToLog(Str);
        };
    };
}