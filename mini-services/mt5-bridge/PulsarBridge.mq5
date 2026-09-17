//+------------------------------------------------------------------+
//|                                              PulsarBridge.mq5     |
//|                              Pulsar Crypto Scalping Engine        |
//|                                                                  |
//|  This Expert Advisor connects your MT5 terminal to the Pulsar    |
//|  trading app via the MT5 Bridge REST API server.                |
//|                                                                  |
//|  INSTALLATION:                                                   |
//|  1. Copy this file to: MT5/MQL5/Experts/PulsarBridge.mq5       |
//|  2. Compile in MetaEditor (F7)                                   |
//|  3. Start the bridge server:  bun run mini-services/mt5-bridge   |
//|  4. Attach the EA to any chart in MT5                            |
//|  5. Allow algorithmic trading                                    |
//|                                                                  |
//|  The EA polls the bridge server every 500ms for pending orders.  |
//|  When it receives one, it executes it in MT5 and reports back.   |
//+------------------------------------------------------------------+
#property copyright "Pulsar Engine"
#property version   "1.00"
#property strict

input string BridgeUrl = "http://localhost:3030";
input int    PollIntervalMs = 500;
input int    HeartbeatIntervalMs = 5000;

string pendingUrl;
string resultUrl;
string heartbeatUrl;
datetime lastHeartbeat = 0;
string httpHeaders = "Content-Type: application/json\r\n";

int OnInit()
{
   pendingUrl = BridgeUrl + "/api/pending";
   resultUrl = BridgeUrl + "/api/result";
   heartbeatUrl = BridgeUrl + "/api/heartbeat";
   
   Print("=== Pulsar MT5 Bridge Started ===");
   Print("Bridge URL: ", BridgeUrl);
   Print("Account: ", AccountInfoString(ACCOUNT_COMPANY));
   Print("Balance: ", AccountInfoDouble(ACCOUNT_BALANCE), " ", AccountInfoString(ACCOUNT_CURRENCY));
   
   EventSetMillisecondTimer(PollIntervalMs);
   SendHeartbeat();
   
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("=== Pulsar MT5 Bridge Stopped ===");
}

void OnTimer()
{
   PollForOrders();
   
   if(TimeCurrent() - lastHeartbeat >= HeartbeatIntervalMs / 1000)
   {
      SendHeartbeat();
   }
}

void SendHeartbeat()
{
   lastHeartbeat = TimeCurrent();
   
   string body = StringFormat(
      "{\"balance\":%.2f,\"equity\":%.2f,\"currency\":\"%s\",\"server\":\"%s\",\"openPositions\":%d}",
      AccountInfoDouble(ACCOUNT_BALANCE),
      AccountInfoDouble(ACCOUNT_EQUITY),
      AccountInfoString(ACCOUNT_CURRENCY),
      AccountInfoString(ACCOUNT_COMPANY),
      PositionsTotal()
   );
   
   char post[];
   char result[];
   string headers = httpHeaders;
   string url = heartbeatUrl;
   
   int res = WebRequest("POST", url, headers, 5000, post, result, headers);
   if(res == -1)
   {
      Print("Heartbeat failed — is the bridge server running on ", BridgeUrl, "?");
   }
}

void PollForOrders()
{
   char post[];
   char result[];
   string resultHeaders;
   string url = pendingUrl;
   
   int res = WebRequest("GET", url, "", 5000, post, result, resultHeaders);
   
   if(res == -1)
   {
      return; // Server not running, silently retry
   }
   
   if(res != 200)
   {
      return;
   }
   
   string response = CharArrayToString(result);
   if(StringLen(response) < 5 || response == "null")
   {
      return; // No pending orders
   }
   
   // Parse the order JSON
   string orderId = GetJsonField(response, "id");
   string symbol = GetJsonField(response, "symbol");
   string side = GetJsonField(response, "side");
   string volumeStr = GetJsonField(response, "volume");
   string slStr = GetJsonField(response, "stopLoss");
   string tpStr = GetJsonField(response, "takeProfit");
   string closeOrderStr = GetJsonField(response, "closeOrder");
   string ticketStr = GetJsonField(response, "ticket");
   
   // Check if this is a close order
   if(closeOrderStr == "true")
   {
      ulong ticket = (ulong)StringToInteger(ticketStr);
      bool success = PositionClose(ticket);
      ReportResult(orderId, success, ticket, success ? "" : "Close failed");
      return;
   }
   
   // Execute the trade
   double volume = StringToDouble(volumeStr);
   double sl = StringToDouble(slStr);
   double tp = StringToDouble(tpStr);
   
   MqlTradeRequest request;
   MqlTradeResult tradeResult;
   ZeroMemory(request);
   ZeroMemory(tradeResult);
   
   request.symbol = symbol;
   request.volume = volume;
   request.sl = sl;
   request.tp = tp;
   request.deviation = 20;
   request.magic = 0;
   
   if(side == "BUY")
   {
      request.type = ORDER_TYPE_BUY;
      request.action = TRADE_ACTION_DEAL;
      request.price = SymbolInfoDouble(symbol, SYMBOL_ASK);
   }
   else
   {
      request.type = ORDER_TYPE_SELL;
      request.action = TRADE_ACTION_DEAL;
      request.price = SymbolInfoDouble(symbol, SYMBOL_BID);
   }
   
   bool success = OrderSend(request, tradeResult);
   
   string error = "";
   if(!success || tradeResult.retcode != TRADE_RETCODE_DONE)
   {
      error = StringFormat("retcode=%d", tradeResult.retcode);
   }
   
   ReportResult(orderId, success && tradeResult.retcode == TRADE_RETCODE_DONE, 
                tradeResult.order, error);
   
   Print(StringFormat("[Pulsar] %s %s %.2f %s → ticket #%d (%s)",
      side, symbol, volume, 
      success ? "OK" : "FAILED",
      tradeResult.order,
      error));
}

void ReportResult(string orderId, bool success, ulong ticket, string error)
{
   string body = StringFormat(
      "{\"orderId\":\"%s\",\"success\":%s,\"ticket\":%llu,\"error\":\"%s\"}",
      orderId,
      success ? "true" : "false",
      ticket,
      error
   );
   
   char post[];
   StringToCharArray(body, post, 0, WHOLE_ARRAY, CP_UTF8);
   // Remove null terminator
   ArrayResize(post, ArraySize(post) - 1);
   
   char result[];
   string headers = httpHeaders;
   string url = resultUrl;
   
   WebRequest("POST", url, headers, 5000, post, result, headers);
}

string GetJsonField(string json, string field)
{
   string searchStr = "\"" + field + "\":";
   int start = StringFind(json, searchStr);
   if(start < 0) return "";
   
   start += StringLen(searchStr);
   
   // Skip whitespace
   while(start < StringLen(json) && (StringGetCharacter(json, start) == ' ' || StringGetCharacter(json, start) == '\t'))
      start++;
   
   // Check if value is a string (starts with ")
   if(StringGetCharacter(json, start) == '"')
   {
      start++;
      int end = StringFind(json, "\"", start);
      if(end < 0) return "";
      return StringSubstr(json, start, end - start);
   }
   
   // Numeric or boolean value
   int end = start;
   while(end < StringLen(json))
   {
      int ch = StringGetCharacter(json, end);
      if(ch == ',' || ch == '}' || ch == ']' || ch == ' ' || ch == '\n')
         break;
      end++;
   }
   
   return StringSubstr(json, start, end - start);
}
