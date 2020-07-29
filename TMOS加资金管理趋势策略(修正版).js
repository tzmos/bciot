// fmz@b0e84356d2f191a937e9049c5ce4d403
/**
 * 2020.6.26 10:00 增强了代码的普遍适用性，使得应用不同币种时，只要调整相关币种的参数就可以.
 * 2020.7.02 15:30 增加了代码的可控性：只要亏损大于等于盈利的2/3或亏损大于等于初始本金的2%(这里你可以自定义百分比)，程序会自动停止交易.
 * 2020.7.08 08:30 增强了的代码的预警智能化：让每次交易后，就会让相应的交易信息发送到微信提醒.以便后面交易策略的决策.从而进一步增强了风控.
 * 2020.7.12 22:00 修复了重试购买时出现的资金不足时，一直出错的BUG.
 * 
 * @TMOS 量化团队 {TMOS趋势策略}
 */
var ExchangProcessor={
    createNew: function(exc_obj){
        //策略参数
        var price_n={BTC_USDT:8,ETH_USDT:8,XRP_USDT:8,EOS_USDT:8,LTC_USDT:8,DASH_USDT:8,CET_USDT:8,BCH_USDT:8,BSV_USDT:8,EOS_BTC:8,ETH_BTC:8}; //价格精度
        var num_n={BTC_USDT:8,ETH_USDT:8,XRP_USDT:8,EOS_USDT:8,LTC_USDT:8,DASH_USDT:8,CET_USDT:8,BCH_USDT:8,BSV_USDT:8,EOS_BTC:8,ETH_BTC:8}; //数量精度
        var minest_buy={BTC_USDT:0.000001,ETH_USDT:0.00001,XRP_USDT:1,EOS_USDT:0.01,LTC_USDT:0.1,DASH_USDT:0.01,CET_USDT:1,BCH_USDT:0.01,BSV_USDT:0.01,EOS_BTC:1,ETH_BTC:0.01};//最小买入量
        var minest_sell={BTC_USDT:0.000001,ETH_USDT:0.00001,XRP_USDT:1,EOS_USDT:0.01,LTC_USDT:0.1,DASH_USDT:0.01,CET_USDT:1,BCH_USDT:0.01,BSV_USDT:0.01,EOS_BTC:1,ETH_BTC:0.01};//最小卖出量
        
        //全局状态变量
        var coincount=[];//记录成交购买币的次数
        var init_asset=0; //初始资产
        var trades=[];//所有交易
        var trades_recorder=true;//记录所有交易
        var pre_time=null; //记录轮询间隔时间
        var order_wait_secs = 500;
        var approximate_profit=0;//盈亏近似值
        var trade_count=0;//已经交易总次数
        var profit_sum = 0 //盈利总金额
        var loss_sum = 0 //亏损总金额
        var profitnum = 0
        var lossnum = 0
        var winrate = 0 //胜率
        var winloss = 0 //盈亏比
        var Fkl = 0 //凯利公式
        var balancelast = 0;
        var stockslast = 0;
        var totallast = 0;
        var pre_cur_asset = 0;//之前的资产总额
        var new_init_asset = 0; //经过凯利公式计算后与现有帐户USDT的%
        var new_init_stocks = 0;//经过凯利公式计算后与现有帐户当前币数量的%
        var withdrawbalanceusdt = 0
        var withdrawbalanceeos = 0
        var withdrawbalanceeth = 0
        var withdrawbalancebtc = 0
        var withdrawtotalUSDT = 0
        var withdrawtotalETH = 0
        var withdrawtotalEOS = 0
        var processor={};
        //重试购买，直到成功返回
         processor.retryBuy=function(ex,price,num)
        {
            var currency=ex.GetCurrency();
            if (num<minest_buy[currency]){

                Log(currency+":"+"买入"+num+"=>"+"低于最小交易量,已忽略");
                return null;
            }
            var r=ex.Buy(_N(price,price_n[currency]), _N(num,num_n[currency]));
           while (!r){
                Log("购买失败，正在重试购买...");
                Sleep(wait_ms);
                var account=_C(ex.GetAccount);
                var ticker=_C(ex.GetTicker);
                var last=ticker.Last;
                if(account.Balance / last*(1 - fee) < minest_buy[currency] && account.Balance <= num * last || num < minest_buy[currency]){
                    break;
                }
                var fixedAmount=(price===-1 ? Math.min(account.Balance * (1 - fee),num) : Math.min(account.Balance / last*(1 - fee),num));
                r=ex.Buy(_N(price,price_n[currency]), _N(fixedAmount,num_n[currency]));
            }
            return r;
        }
        
        //重试卖出，直到成功返回
        processor.retrySell=function(ex,price,num){
            var currency=ex.GetCurrency();
            if (num<minest_sell[currency]){

                Log(currency+":"+"卖出"+num+"=>"+"低于最小交易量已忽略");
                return null;
            }
            var r=ex.Sell(_N(price,price_n[currency]), _N(num,num_n[currency]));
            while (!r){
                Log("出售失败，正在重试出售...");
                Sleep(wait_ms);
                var account=_C(ex.GetAccount);
                if(account.Stocks * (1 - fee) < minest_sell[currency] || num < minest_sell[currency]){
                    break;
                }
                var fixedAmount=Math.min(account.Stocks,num);
                r=ex.Sell(_N(price,price_n[currency]), _N(fixedAmount,num_n[currency]));
            }
            return r;
        }
        
        processor.get_ChinaTimeString=function(){//获取UTC时间
            var date = new Date(); 
            var now_utc =  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
                    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
            var cdate=new Date(now_utc);
            cdate.setHours(cdate.getHours()+8);
            var localstring=cdate.getFullYear()+'/'+(cdate.getMonth()+1)+'/'+cdate.getDate()+' '+cdate.getHours()+':'+cdate.getMinutes()+':'+cdate.getSeconds();
            return localstring;
        }
        
        processor.init_obj=function(){//初始化资产
            _CDelay(wait_ms);
            pre_time = new Date();
            //init
            {
                var account=_C(exc_obj.GetAccount);
                var ticker=_C(exc_obj.GetTicker);
                var last=ticker.Last;
                init_asset=_N(((account.Balance+account.FrozenBalance)+(account.Stocks+account.FrozenStocks)*last),6);
                Sleep(wait_ms);
            }
        }

        processor.Ema55= function() { //计算日线144移动平均线函数

            var recordd = null
            while (1) {
                //var rec144 = _C(exc_obj.GetRecords)
                recordd = _C(exc_obj.GetRecords)//processor.GetNewCycleRecords(rec144,1000 * 60 * 60 * 4)
                if (recordd.length > 144) { //获得交易所K线长度要大于它的慢线长度，这样才有数据。

                    break
                }

                Sleep(wait_ms)
            }
            var ma55d = TA.EMA(recordd, 144)
            var ma55last = ma55d[ma55d.length - 1]
            return ma55last

        }

        processor.coincountsort= function (coincount) { // 对所有记录成交的买单进行价格按降序排序。
            var buycoincount = []; // 用于存放最高的价格
            coincount.sort(function(x, y) {
                return x.buy_price - y.buy_price;
            }); // 排序 ， coincount 成交单的 buy_price 属性， 从大到小
            for (var j = 0; j < coincount.length; j++) { // 遍历 coincount  ， 注意已经排过序
                buycoincount.push(coincount[j].buy_price);
            }

            return buycoincount;
        }

        processor.OnTick=function(){
            var cur_time = new Date();
            var passedtime=cur_time-pre_time;
            pre_time=cur_time;
            //计算各交易所您帐户下的当前情况
            var exname=exc_obj.GetName();
            var currency=exc_obj.GetCurrency();
            var account=_C(exc_obj.GetAccount);
            var ticker=_C(exc_obj.GetTicker);
            var depth = _C(exc_obj.GetDepth);
            var last=ticker.Last;
            var ask1=depth.Asks[0].Price;
            var bidcoincount=processor.coincountsort(coincount);
            //当前操作周期的布林通道
            var records = _C(exc_obj.GetRecords);
            if (records.length<=21){
                Log("数据长度不足.");
                Sleep(wait_ms);
                return;
            }
            var boll = TA.BOLL(records,21,2)
            var upLine = _N(boll[0][boll[0].length - 1],7);
            var midLine = _N(boll[1][boll[1].length - 1],7);
            var downLine = _N(boll[2][boll[2].length - 1],7);
            var upLinepre = _N(boll[0][boll[0].length - 2],7);
            var midLinepre = _N(boll[1][boll[1].length - 2],7);
            var downLinepre = _N(boll[2][boll[2].length - 2],7);
            var upLineold = _N(boll[0][boll[0].length - 3],7);
            var midLineold = _N(boll[1][boll[1].length - 3],7);
            var downLineold = _N(boll[2][boll[2].length - 3],7);
            var atr = TA.ATR(records, 20);
            if (atr.length<=1){
                Log("atr.length is not valid.");
                Sleep(wait_ms);
                return;
            }
            var N= _N(atr[atr.length-1],8);
            var coincount_unit=_N(Math.min(mess_acount/N,account.Balance/last*(1-fee)/max_add),3);
            var highest=TA.Highest(records, 20, 'High');
            var lowest=TA.Lowest(records, 10, 'Low');
            var cur_asset=_N(((account.Balance+account.FrozenBalance)+(account.Stocks+account.FrozenStocks)*last),6);
            var midPrice = _N((ticker.Buy + ticker.Sell) / 2, 6); // 计算 盘口空隙中间的位置的价格。
            var buyPrice = midPrice + Spread; // 在盘口中间位置 上下 一定 挂单价格间隔， 挂单，设置挂买单价 buyPrice
            var sellPrice = midPrice - Spread; // 在盘口中间位置 上下 一定spread 挂单价格间隔， 挂单，设置挂买卖单价 sellPrice
            /**现货建仓**/
            //if(ticker.Low >= lowest6 >= lowest12 >= lowest24 >= lowest48 >= lowest72){
                //if(upLine > processor.Ema55() && midLine >= processor.Ema55()){//upLine > processor.Ema55() && midLine >= processor.Ema55()
                    if(coincount_unit > minest_buy[currency] && coincount.length == 0){
                        if((upLine - midLine) >= BollWide || (downLine - midLine) <= -BollWide){
                            var count = coincount_unit / 2
                            records = _C(exc_obj.GetRecords)
                            ticker=_C(exc_obj.GetTicker)
                            last=ticker.Last;
                            account = _C(exc_obj.GetAccount);
                            cur_asset=_N(((account.Balance+account.FrozenBalance)+(account.Stocks+account.FrozenStocks)*last),6);
                            //Log("cur_asset:",cur_asset,"init_asset:",init_asset,"#ff0000");
                            if(cur_asset <= (init_asset - init_asset * loss_percent_i) || Math.abs(loss_sum) >= profit_sum * 2 / 3 && Math.abs(loss_sum) >0 && profit_sum > 0){
                                Log("当前资金:"+cur_asset+"低于本金:"+init_asset+"的"+loss_percent_i*100+"%======","或者亏损总额:"+_N(Math.abs(loss_sum),5)+"大于等于盈利总额:",+_N(profit_sum,5)+"的2/3!======请暂停机器人运行！","#FF0000","@");
                                Sleep(60000);
                                return;
                            }
                            if((records[records.length - 2].Close < downLinepre) && (last < downLine)){
                                var buyID = processor.retryBuy(exc_obj,buyPrice,count);
                                Sleep(order_wait_secs);
                                var buyOrder=_C(exc_obj.GetOrder,buyID);
                                if(buyOrder.Status!=ORDER_STATE_CLOSED){
                                    exc_obj.CancelOrder(buyID);
                                }
                                if(buyOrder.DealAmount>0){//记录此次成交的信息
                                    var note = {
                                    deal_date:_D(),
                                    amount:buyOrder.DealAmount,
                                    buy_price:buyOrder.AvgPrice, 
                                    stoploss_down_price:buyOrder.AvgPrice - (buyOrder.AvgPrice * stop_loss_r),
                                    stopwin_price:buyOrder.AvgPrice * (stop_profit_r + 1),
                                    mid_price:midLine,
                                    up_price:upLine
                                    };
                                    coincount.push(note);
                        
                                    var details={
                                        type:"现货建仓详情",
                                        time:_D(),
                                        RealAmount:buyOrder.DealAmount,
                                        WantAmount:coincount_unit,
                                        RealPrice:buyOrder.AvgPrice,
                                        WantPrice:buyOrder.Price,
                                        Memo:""
                                    };
                                    if (trades_recorder){
                                        trades.push(details);
                                    }
                        
                                    trade_count++;
                                    Sleep(wait_ms);
                                    Log("购买数量：",coincount[coincount.length - 1].amount+"==="+"成交均价：",coincount[coincount.length - 1].buy_price,"#00FF00","@");
                                }
                            }
                        }
                    }
                //}
            //}
            
            //现货加仓
            if (coincount.length>0 && coincount_unit>minest_buy[currency] && account.Balance > coincount_unit * buyPrice){
                var last_buy_price=coincount[coincount.length-1].buy_price;
                account = _C(exc_obj.GetAccount);
                cur_asset=_N(((account.Balance+account.FrozenBalance)+(account.Stocks+account.FrozenStocks)*last),6);
                if(cur_asset <= (init_asset - init_asset * loss_percent_i) || profit_sum * 2 / 3 <= Math.abs(loss_sum) && Math.abs(loss_sum) >0 && profit_sum > 0){
                    Log("当前资金:"+cur_asset+"低于本金:"+init_asset+"的"+loss_percent_i*100+"%======","或者亏损总额:"+_N(Math.abs(loss_sum),5)+"大于等于盈利总额:",+profit_sum+"的2/3!======请暂停机器人运行！","#FF0000","@");
                    Sleep(60000);
                    return;
                }
                if (trade_count<max_add){//max = 4
                    if ( last_buy_price - last >= 1.5*N){
                        var buyID = processor.retryBuy(exc_obj,last,coincount_unit);
                        Sleep(order_wait_secs);
                        var buyOrder=_C(exc_obj.GetOrder,buyID);
                        if (buyOrder.Status!=ORDER_STATE_CLOSED){
                            exc_obj.CancelOrder(buyID);
                        }
                        if (buyOrder.DealAmount>0){
                            var note = {
                                    deal_date:_D(),
                                    amount:buyOrder.DealAmount, 
                                    buy_price:buyOrder.AvgPrice, 
                                    stoploss_down_price:buyOrder.AvgPrice - (buyOrder.AvgPrice * stop_loss_r),
                                    stopwin_price:buyOrder.AvgPrice * (stop_profit_r + 1),
                                    mid_price:midLine,
                                    up_price:upLine
                                    
                                };
                            coincount.push(note);
                            var details={
                                        type:"现货加仓详情",
                                        time:_D(),
                                        RealAmount:buyOrder.DealAmount,
                                        WantAmount:coincount_unit,
                                        RealPrice:buyOrder.AvgPrice,
                                        WantPrice:buyOrder.Price,
                                        Memo:""
                                };
                                if (trades_recorder){
                                    trades.push(details);
                                }
                            trade_count++;
                        }
                        Sleep(wait_ms);
                        Log("加仓数量：",coincount[coincount.length - 1].amount+"==="+"加仓均价：",coincount[coincount.length - 1].buy_price,"#00FF00","@");
                    }
                }
            }
            //现货平仓
            if(coincount.length > 0 && (account.Stocks * (1-fee) > coincount_unit)){
              //if(midLine > processor.Ema55()){
                for (var x = 0; x < coincount.length; x++){  
                    if((upLine - midLine) >= BollWide || (downLine - midLine) <= -BollWide){
                        records = _C(exc_obj.GetRecords)
                        ticker=_C(exc_obj.GetTicker)
                        last=ticker.Last
                        if ((last > upLine && last > coincount[x].up_price) || last >= (coincount[x].buy_price * 0.05 + coincount[x].buy_price)){
                            account=_C(exc_obj.GetAccount);
                            var fixedAmountP = Math.min(account.Stocks,coincount[x].amount);
                            if (fixedAmountP > minest_sell[currency]){
                                var sellID = processor.retrySell(exc_obj, sellPrice, fixedAmountP);
                                Sleep(order_wait_secs); 
                                var sellOrder=_C(exc_obj.GetOrder,sellID);
                                if (sellOrder.Status!=ORDER_STATE_CLOSED){
                                    exc_obj.CancelOrder(sellID);
                                }
                                if (sellOrder.DealAmount>0){
                                    var detailselldown={
                                        type:"现货平仓详情",
                                        time:_D(),
                                        RealAmount:sellOrder.DealAmount,
                                        WantAmount:-1,//coincount_unit,
                                        RealPrice:sellOrder.AvgPrice,
                                        WantPrice:-1,//sellOrder.Price,
                                        Memo:(sellOrder.AvgPrice > coincount[x].buy_price?"盈利":"亏损")
                                    };
                                    if (trades_recorder){
                                        trades.push(detailselldown);
                                    }
                                    if(detailselldown.Memo === "盈利"){
                                        profitnum++;
                                        profit_sum += _N(detailselldown.RealPrice * detailselldown.RealAmount * (1 - fee) - coincount[x].buy_price * detailselldown.RealAmount * (1 - fee),5);
                                    }else{
                                        lossnum++;
                                        loss_sum += _N((detailselldown.RealPrice * detailselldown.RealAmount * (1 - fee) - coincount[x].buy_price * detailselldown.RealAmount * (1 - fee)),5);
                                    }
                                    Sleep(500);
                                    account = _C(exc_obj.GetAccount);
                                    cur_asset=_N(((account.Balance+account.FrozenBalance)+(account.Stocks+account.FrozenStocks)*last),6);
                                    pre_cur_asset = cur_asset;
                                    approximate_profit = _N((cur_asset - init_asset),7);
                                    //向微信推送每次交易的真实盈亏额
                                    Log("当前盈利总额度：",_N(profit_sum,7),"当前亏损总额度：",_N(loss_sum,7),"当前净利润：",approximate_profit,"#00FF00","@");
                                    Sleep(wait_ms);
                                    trade_count++;
                                    
                                }
                            }
                        }
                    }
                }
              //}
            }
            
            //现货移动止盈清仓
            if (coincount.length > 0){
                var coincount_new = [];
                ticker=_C(exc_obj.GetTicker);
                last=ticker.Last;
                upLine = _N(boll[0][boll[0].length - 1],2);
                midLine = _N(boll[1][boll[1].length - 1],2);
                for (var y = 0; y < coincount.length; y++){
                    if (last >= coincount[y].mid_price && last <= midLine && (upLine - midLine) >= BollWide || last >= coincount[y].stopwin_price){
                        account = _C(exc_obj.GetAccount);
                        var fixedAmount = Math.min(account.Stocks,coincount[y].amount);
                        if (fixedAmount > minest_sell[currency]){
                            var sellID = processor.retrySell(exc_obj, last, fixedAmount);
                            Sleep(order_wait_secs);
                            var sellOrder=_C(exc_obj.GetOrder,sellID);
                            Log("定价卖出: 数量-"+sellOrder.DealAmount+",盈亏收益近值:"+approximate_profit);
                            if (sellOrder.Status!=ORDER_STATE_CLOSED){
                                exc_obj.CancelOrder(sellID);
                                if (Math.min(account.Stocks,fixedAmount-sellOrder.DealAmount)>minest_sell[currency]){
                                    var marketsellOrderID=processor.retrySell(exc_obj, -1, fixedAmount-sellOrder.DealAmount);
                                    Sleep(order_wait_secs);
                                    var marketsellOrderData=_C(exc_obj.GetOrder,marketsellOrderID);
                                    Log("市价卖出: 数量-"+marketsellOrderData.DealAmount+",盈亏收益近值:"+approximate_profit);
                                }
                            }
                            var detailloss = {
                                type:"现货移动止盈",
                                time:_D(),
                                RealAmount:-1,
                                WantAmount:fixedAmount,
                                RealPrice:-1,
                                WantPrice:last,
                                Memo:(last > coincount[y].buy_price?"盈利":"亏损")
                            };
                            if (trades_recorder){
                                trades.push(detailloss);
                            }
                            if(detailloss.Memo === "盈利"){
                                profitnum++;
                                profit_sum += _N(detailloss.WantPrice * detailloss.WantAmount * (1-fee) - coincount[y].buy_price * detailloss.WantAmount * (1 - fee),5);
                            }else{
                                lossnum++;
                                loss_sum += _N((detailloss.WantPrice * detailloss.WantAmount * (1-fee) - coincount[y].buy_price * detailloss.WantAmount * (1 - fee)),5);
                            }
                            Sleep(500);
                            account = _C(exc_obj.GetAccount);
                            cur_asset=_N(((account.Balance+account.FrozenBalance)+(account.Stocks+account.FrozenStocks)*last),6);
                            pre_cur_asset = cur_asset;
                            approximate_profit = _N((cur_asset - init_asset),7);
                            //向微信推送每次交易的真实盈亏额
                            Log("当前盈利总额度：",_N(profit_sum,7),"当前亏损总额度：",_N(loss_sum,7),"当前净利润：",approximate_profit,"#00FF00","@");
                            Sleep(wait_ms);
                        }
                        trade_count++;
                    }else{
                        coincount_new.push(coincount[y]);
                    }
                }
                coincount=coincount_new;
            }
            //现货止损清仓
            if (coincount.length > 0){
                var coincount_new = [];
                ticker=_C(exc_obj.GetTicker);
                last=ticker.Last;
                //upLine = _N(boll[0][boll[0].length - 1],2);
                //midLine = _N(boll[1][boll[1].length - 1],2);
                for (var z = 0; z < coincount.length; z++){
                    if (last <= coincount[z].stoploss_down_price){
                        account = _C(exc_obj.GetAccount);
                        var fixedAmount = Math.min(account.Stocks,coincount[z].amount);
                        if (fixedAmount > minest_sell[currency]){
                            var sellID = processor.retrySell(exc_obj, last, fixedAmount);
                            Sleep(order_wait_secs);
                            var sellOrder=_C(exc_obj.GetOrder,sellID);
                            Log("定价卖出: 数量-"+sellOrder.DealAmount+",盈亏收益近值:"+approximate_profit);
                            if (sellOrder.Status!=ORDER_STATE_CLOSED){
                                exc_obj.CancelOrder(sellID);
                                if (Math.min(account.Stocks,fixedAmount-sellOrder.DealAmount)>minest_sell[currency]){
                                    var marketsellOrderID=processor.retrySell(exc_obj, -1, fixedAmount-sellOrder.DealAmount);
                                    Sleep(order_wait_secs);
                                    var marketsellOrderData=_C(exc_obj.GetOrder,marketsellOrderID);
                                    Log("市价卖出: 数量-"+marketsellOrderData.DealAmount+",盈亏收益近值:"+approximate_profit);
                                }
                            }
                            var detailloss = {
                                type:"现货止损清仓",
                                time:_D(),
                                RealAmount:-1,
                                WantAmount:fixedAmount,
                                RealPrice:-1,
                                WantPrice:last,
                                Memo:(last > coincount[z].buy_price?"盈利":"亏损")
                            };
                            if (trades_recorder){
                                trades.push(detailloss);
                            }
                            if(detailloss.Memo === "盈利"){
                                profitnum++;
                                profit_sum += _N(detailloss.WantPrice * detailloss.WantAmount * (1-fee) - coincount[z].buy_price * detailloss.WantAmount * (1 - fee),5);
                            }else{
                                lossnum++;
                                loss_sum += _N((detailloss.WantPrice * detailloss.WantAmount * (1-fee) - coincount[z].buy_price * detailloss.WantAmount * (1 - fee)),5);
                            }
                            Sleep(500);
                            account = _C(exc_obj.GetAccount);
                            cur_asset=_N(((account.Balance+account.FrozenBalance)+(account.Stocks+account.FrozenStocks)*last),6);
                            pre_cur_asset = cur_asset;
                            approximate_profit = _N((cur_asset - init_asset),7);
                           //向微信推送每次交易的真实盈亏额
                            Log("当前盈利总额度：",_N(profit_sum,7),"当前亏损总额度：",_N(loss_sum,7),"当前净利润：",approximate_profit,"#00FF00","@");
                            Sleep(wait_ms);
                        }
                        trade_count++;
                    }else{
                        coincount_new.push(coincount[z]);
                    }
                }
                coincount=coincount_new;
            }

            //对收益情况的相关统计与盘点
            account = _C(exc_obj.GetAccount);
            cur_asset=_N(((account.Balance+account.FrozenBalance)+(account.Stocks+account.FrozenStocks)*last),6);
            if(balancelast != (account.Balance + account.FrozenBalance) || stockslast != (account.Stocks + account.FrozenStocks)){//判断当前的余额与币数是否与最新的相等,如果不等执行下面代码
                if(cur_asset > init_asset){//如果最新总额大于初始总额计算收益差额
                    approximate_profit = _N((cur_asset - init_asset),7)
                }
                else if(cur_asset <= init_asset){//如果最新总额小于初始总额计算亏损差额

                    approximate_profit = _N((cur_asset - init_asset),7)
                }
            }
            if(profitnum > 0 && lossnum > 0){
                winrate = _N(profitnum / (profitnum + lossnum),7);// 计算胜率.
                winloss = _N(profit_sum / profitnum / Math.abs(loss_sum / lossnum),7);//计算盈亏比.
            }
            if(winrate >=0.3 && winrate <= 0.8 && winloss > 0){
                Fkl = _N((winrate * (winloss + 1) -1) / winloss,7);//计算凯利值.
            }
            //对交易所的个人帐户下的收益资金的提取
            account = _C(exc_obj.GetAccount);
            balancelast = _N((account.Balance + account.FrozenBalance),5);
            stockslast = _N((account.Stocks + account.FrozenStocks),5);
            if(cur_asset > init_asset){//如果当前资产大于初始资产
                var e = exc_obj;
                if(winrate * (winloss + 1) -1 > 0){
                   if(balancelast >= new_init_asset){
                      new_init_asset = balancelast * Fkl
                    }else if(stockslast * last >= new_init_asset){
                        new_init_stocks = stockslast * Fkl
                    }
                }
                if(approximate_profit >= ThresHold && Fkl >= 0.2){
                    currency=exc_obj.GetCurrency();
                    account=_C(exc_obj.GetAccount);
                    ticker=_C(exc_obj.GetTicker);
                    if(balancelast > new_init_asset && stockslast <= new_init_stocks){
                        withdrawbalanceusdt = balancelast - new_init_asset -  _N((new_init_stocks - stockslast) * last,2)
                        $.withdraw(e, "usdt", "0xE4a2b662cB7a2B2aec8436c2d92C6a665D404746", withdrawbalanceusdt, WithDrawFeeUSDT, password)
                        withdrawtotalUSDT +=withdrawbalanceusdt - WithDrawFeeUSDT
                    }else if(balancelast <= new_init_asset && stockslast > new_init_stocks){
                        withdrawbalanceeos = stockslast - new_init_stocks - _N((new_init_asset - balancelast)/last,5)
                        $.withdraw(e, "eos", "gyzdmobwhage", withdrawbalanceeos, WithDrawFeeEOS, password)
                        withdrawtotalEOS +=withdrawbalanceeos - WithDrawFeeEOS
                    }else if(balancelast > new_init_asset && stockslast > new_init_stocks){
                        withdrawbalanceusdt = _N(balancelast - new_init_asset)
                        withdrawbalanceos = _N(stockslast - new_init_stocks)
                        $.withdraw(e, "usdt", "0xE4a2b662cB7a2B2aec8436c2d92C6a665D404746", withdrawbalanceusdt, WithDrawFeeUSDT, password)
                        $.withdraw(e, "eos", "gyzdmobwhage", withdrawbalanceeos, WithDrawFeeEOS, password)
                        withdrawtotalUSDT +=withdrawbalanceusdt - WithDrawFeeUSDT
                        withdrawtotalEOS +=withdrawbalanceeos - WithDrawFeeEOS
                    }
                }
            }
            //显示状态
            var tablexz = {type: 'table', title: '现货帐户仓位-'+exname+'('+currency+')', cols: ['成交时间','成交数量', '成交价','止损价','止盈价'], rows: []};
            var tablezt = {type: 'table', title: '状态-'+exname+'('+currency+')', cols: ['平均真实波幅(N)','买卖数量单位','初始资产','当前资产','轮询时间','最新价','盈利总金额','亏损总金额','交易盈利总次数','交易亏损总次数','交易总次数','胜率','盈亏比','凯利值','近似盈亏'], rows: []};
            var tablels = {type: 'table', title: '交易历史-'+exname+'('+currency+')', cols: ['日期','类型', '成交数量','发单数量','成交价','发单价','备注'], rows: []};
            var tablewithdraw = {
              type: "table",
              title: '提现状态-'+exname+'('+currency+')',
              cols: ['当前资金余额','当前冻结资金','当前持有币数(个)','当前冻结币数(个)','当前已提法币额度','当前已提币额度(个)','累计已提资金额度','累计已提币(个)'],
              rows: []
            }
            for (var o = 0; o < coincount.length; o++){
                tablexz.rows.push([coincount[o].deal_date,coincount[o].amount,_N(coincount[o].buy_price，7）,_N(coincount[o].stoploss_down_price,7),_N(coincount[o].stopwin_price,7)]);
            }
            tablezt.rows.push([N,coincount_unit,init_asset,cur_asset,passedtime/1000+'秒',last,_N(profit_sum,5),_N(loss_sum,5),profitnum,lossnum,trade_count, _N(winrate * 100,3) + '%',_N(winloss,3),_N(Fkl,3),_N(approximate_profit,6)]);
            for (var p = 0; p < trades.length; p++){
                tablels.rows.push([trades[p].time,trades[p].type,trades[p].RealAmount,trades[p].WantAmount,_N(trades[p].RealPrice，7）,trades[p].WantPrice,trades[p].Memo]);
            }
            tablewithdraw.rows.push([balancelast,account.FrozenBalance,stockslast,account.FrozenStocks,withdrawbalanceusdt,withdrawbalanceeos,withdrawtotalUSDT,withdrawtotalEOS]);
            processor.logstatus = ('`' + JSON.stringify([tablexz, tablezt, tablels,tablewithdraw]) + '`'+'\n');
            Sleep(wait_ms)
            //画出盈利曲线
            processor.logprofit = approximate_profit;
            Sleep(wait_ms);
        }
        
        return processor;
    }
};


function main() {
    LogReset();
    LogProfitReset();
    //exchange.SetPrecision(2,5);
    var exchange_num = exchanges.length;
    var processors = [];
    for (var i = 0; i < exchange_num; ++i){
        var q = ExchangProcessor.createNew(exchanges[i]);
        processors.push(q);
    }
    for (i=0; i < exchange_num; ++i){
        processors[i].init_obj();
    }
    var pre_profit = Number("pre_profit");
    //Log('之前收入累计：'+pre_profit);
    var lastprofit = 0;
    while (true) { // 主循环
        var allstatus = '此策略要注重与实盘对照优化!#0000ff'+'\n';
        var allprofit = 0;
        for (i = 0; i < exchange_num; ++i){
            processors[i].OnTick();
            allstatus += processors[i].logstatus;
            allprofit += processors[i].logprofit;
            
        }
        allstatus += ('欢迎加入我们量化团队TMOS #00ff00'+'\n');
        LogStatus(allstatus);
        if (lastprofit !== allprofit){
            var total_profit = Number(pre_profit + allprofit)
            LogProfit(allprofit,'&');
            _G("pre_profit", total_profit);
            lastprofit = allprofit;
        }

    }
}