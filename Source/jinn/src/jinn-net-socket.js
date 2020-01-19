/*
 * @project: JINN
 * @version: 1.0
 * @license: MIT (not for evil)
 * @copyright: Yuriy Ivanov (Vtools) 2019-2020 [progr76@gmail.com]
 * Telegram:  https://t.me/progr76
*/

/**
 *
 * Working with network sockets, creating a network server
 *
**/
'use strict';
const net = require("net");
global.JINN_MODULES.push({InitClass:InitClass, InitAfter:InitAfter});
function InitClass(Engine)
{
    Engine.BAN_IP = {};
    Engine.CreateServer = function ()
    {
        Engine.Server = net.createServer(function (Socket)
        {
            if(Engine.WasBanIP({address:Socket.remoteAddress}))
            {
                Engine.CloseSocket(Socket, "WAS BAN", true);
                return ;
            }
            var Child = Engine.RetNewConnectByIPPort(Socket.remoteAddress, Socket.remotePort, 1);
            if(Child)
                Engine.SetEventsProcessing(Socket, Child, "Client");
            else
                Engine.CloseSocket(Socket, "Error child");
        });
        Engine.Server.on('close', function ()
        {
        });
        Engine.Server.on('error', function (err)
        {
            if(err.code === 'EADDRINUSE')
            {
                Engine.ToLog('Port ' + Engine.port + ' in use, retrying after 5 sec...');
                if(Engine.Server)
                    Engine.Server.close();
                setTimeout(function ()
                {
                    Engine.RunListenServer();
                }, 5000);
            }
        });
        Engine.RunListenServer();
    };
    Engine.RunListenServer = function ()
    {
        if(!Engine.port || typeof Engine.port !== "number")
            throw "Error port number = " + Engine.port;
        var LISTEN_IP = "0.0.0.0";
        Engine.ToDebug("Prepare to run TCP server on " + LISTEN_IP + ":" + Engine.port);
        Engine.Server.listen(Engine.port, LISTEN_IP, function ()
        {
            var AddObj = Engine.Server.address();
            Engine.ToLog("Run JINN TCP server on " + AddObj.family + " " + AddObj.address + ":" + AddObj.port);
        });
    };
    Engine.SetEventsProcessing = function (SOCKET,Child,StrConnect)
    {
        Engine.LinkSocketToChild(SOCKET, Child, StrConnect);
        SOCKET.on('data', function (data)
        {
            if(SOCKET.WasClose)
            {
                return ;
            }
            if(SOCKET.Child)
            {
                if(Engine.GetSocketStatus(SOCKET.Child) === 100)
                {
                    Engine.ReceiveFromNetwork(Child, data);
                }
                else
                {
                    Child.ToLog("CONNECT : Error GetSocketStatus");
                }
            }
        });
        SOCKET.on('close', function (err)
        {
            Engine.ClearSocket(SOCKET);
        });
        SOCKET.on('error', function (err)
        {
            Engine.CloseSocket(SOCKET, "ERRORS");
        });
        SOCKET.on('end', function ()
        {
        });
    };
    Engine.CloseSocket = function (Socket,StrError)
    {
        if(!Socket || Socket.WasClose)
            return ;
        Engine.ToDebug("CloseSocket: " + Socket.remoteAddress + ":" + Socket.remotePort + " " + StrError);
        Engine.ClearSocket(Socket);
        Socket.end();
    };
    Engine.ClearSocket = function (Socket)
    {
        var Child = Socket.Child;
        if(Child)
        {
            Child.Socket = undefined;
            Engine.OnDeleteConnect(Child);
        }
        Socket.WasClose = 1;
        SetSocketStatus(Socket, 0);
        Socket.Child = undefined;
    };
    Engine.WasBanIP = function (rinfo)
    {
        if(!rinfo || !rinfo.address)
            return 0;
        var Key = "" + rinfo.address.trim();
        var Stat = Engine.BAN_IP[Key];
        if(Stat)
        {
            if(Stat.TimeTo > Date.now())
                return 1;
        }
        return 0;
    };
    Engine.LinkSocketToChild = function (Socket,Child,ConnectType)
    {
        if(Socket.Child)
            throw "Error LinkSocketToChild was Linked";
        Child.ConnectType = ConnectType;
        Socket.Child = Child;
        Child.Socket = Socket;
        Child.DirectIP = (ConnectType === "Server");
        SetSocketStatus(Socket, 100);
    };
    Engine.OnDeleteConnectNext = function (Child)
    {
        if(Child.Socket)
            Engine.CloseSocket(Child.Socket);
    };
}
function InitAfter(Engine)
{
    Engine.CreateServer();
    Engine.CreateConnectionToChild = function (Child,F)
    {
        var State = Engine.GetSocketStatus(Child);
        if(State === 100)
        {
            F(1);
        }
        else
        {
            if(State === 0)
            {
                Child.ToDebug("Connect to " + Child.ip + ":" + Child.port);
                Child.Socket = net.createConnection(Child.port, Child.ip, function ()
                {
                    if(Child.Socket)
                    {
                        Engine.SetEventsProcessing(Child.Socket, Child, "Server");
                    }
                    F(!!Child.Socket);
                });
                SetSocketStatus(Child.Socket, 1);
            }
            else
            {
                F(0);
            }
        }
    };
    Engine.CloseConnectionToChild = function (Child)
    {
        if(Child.Close)
        {
            Engine.ToError(Child, "Socket was closed", "t");
            return ;
        }
        if(!Child.IsOpen())
        {
            Engine.ToError(Child, "Socket not was opened", "t");
            return ;
        }
        Engine.CloseSocket(Child.Socket, "Close");
    };
    Engine.SENDTONETWORK = function (Child,Data)
    {
        var State = Engine.GetSocketStatus(Child);
        if(State === 100)
        {
            Child.Socket.write(Buffer.from(Data));
        }
        else
        {
            Child.ToLog("ERROR SEND - NOT WAS CONNECT: State=" + State);
        }
    };
    Engine.GetSocketStatus = function (Child)
    {
        if(!Child)
            return 0;
        var Socket = Child.Socket;
        if(Socket && Socket.SocketStatus)
        {
            if(Socket.SocketStatus !== 100)
            {
                var Delta = Date.now() - Socket.TimeStatus;
                if(Delta > JINN_CONST.MAX_WAIT_PERIOD_FOR_STATUS)
                {
                    return 0;
                }
            }
            return Socket.SocketStatus;
        }
        else
        {
            return 0;
        }
    };
}
function SetSocketStatus(Socket,Status)
{
    if(Socket && Socket.SocketStatus !== Status)
    {
        if(Status === 100 && Socket.Child)
            Socket.Child.LastTime = Date.now();
        Socket.SocketStatus = Status;
        Socket.TimeStatus = Date.now();
    }
}