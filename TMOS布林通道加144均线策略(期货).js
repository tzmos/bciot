// fmz@d576b81a2d3e91eceb7ffcfe6be286eb
var price_n={Futures_OKCoin_BSV_USD:2,Futures_OKCoin_BTC_USD:8,Futures_OKCoin_ETH_USD:8};
var num_n={Futures_OKCoin_BSV_USD:0,Futures_OKCoin_BTC_USD:0,Futures_OKCoin_ETH_USD:0};
var minestbuy={Futures_OKCoin_BSV_USD:1,Futures_OKCoin_BTC_USD:0.001,Futures_OKCoin_ETH_USD:0.12};
var price_step={Futures_OKCoin_BSV_USD:0.05,Futures_OKCoin_BTC_USD:0.001,Futures_OKCoin_ETH_USD:0.12};
var contract_min={Futures_OKCoin_BSV_USD:10,Futures_OKCoin_BTC_USD:10,Futures_OKCoin_ETH_USD:10};
var wait_ms=3000;
var max_wait_order=15000;
var max_positions=4;
//var level = 1;

//gloabl variables
var trades=[];//所有交易
//var trades_kong=[];//所有做空交易
var trades_recorder=true;//记录所有交易
var trade_count=0;//已经交易总次数
var profit_sum = 0 //盈利总金额
var loss_sum = 0 //亏损总金额
var profitnum = 0
var lo_co_sum = 0 //换算成当前交易币的亏损总额
var pr_co_sum = 0 //换算成当前交易币的盈利总额
var lossnum = 0
var winrate = 0 //胜率
var winloss = 0 //盈亏比
//var loss_kongnum = 0
var positions_duo=[];
var positions_kong=[];
var total_loop=0;
var bet_duo=0;
var bet_kong=0;

function main(){
	$.set_params(price_n,num_n,minestbuy,price_step,wait_ms,max_wait_order);
	exchange.SetContractType("this_week");
    exchange.SetMarginLevel(5);
	while(true){
		var exname=exchange.GetName();
		var currency=exchange.GetCurrency();
		var account=_C(exchange.GetAccount);
		var ticker=_C(exchange.GetTicker);
		var last=ticker.Last;
		var depth=_C(exchange.GetDepth);
		var midPrice = _N((ticker.Buy + ticker.Sell) / 2, 2); // 计算 盘口空隙中间的位置的价格。
        var buyPrice = midPrice + Spread; // 在盘口中间位置 上下 一定 挂单价格间隔挂单,滑价设置挂买单价 buyPrice
        var sellPrice = midPrice - Spread; // 在盘口中间位置 上下 一定spread 挂单价格间隔挂单，滑价设置挂卖单价 sellPrice		
		//var sell1=depth.Asks[0].Price;
		//var buy1=depth.Bids[0].Price;
		var records=_C(exchange.GetRecords);
		//EMA 144线
		if (records.length<=144){
			Log("K数量无效,必需要达到均线144的数量.跳过此次执行...");
			Sleep(wait_ms);
			continue;
		}
		var ma144 = TA.EMA(records, 144)
        var ma144last = ma144[ma144.length - 1]
		//布林通道上中下轨
		var boll = TA.BOLL(records,21,2)
        var upLine = _N(boll[0][boll[0].length - 1],2);
        var midLine = _N(boll[1][boll[1].length - 1],2);
        var downLine = _N(boll[2][boll[2].length - 1],2);
        var upLinepre = _N(boll[0][boll[0].length - 2],2);
        var midLinepre = _N(boll[1][boll[1].length - 2],2);
        var downLinepre = _N(boll[2][boll[2].length - 2],2);
        var upLineold = _N(boll[0][boll[0].length - 3],2);
        var midLineold = _N(boll[1][boll[1].length - 3],2);
        var downLineold = _N(boll[2][boll[2].length - 3],2);
        //ATR
		var atr = TA.ATR(records, 20);
		if (atr.length<=1){
			Log("atr.length无效,跳过此次执行...");
			Sleep(wait_ms);
			continue;
		}
		var N=_N(atr[atr.length-1],2);
		var position_unit=_N(mess_acount/N,3);
		var highest20=TA.Highest(records, 20, 'High');
		var lowest20=TA.Lowest(records, 20, 'Low');
		var highest10=TA.Highest(records, 10, 'High');	
		var lowest10=TA.Lowest(records, 10, 'Low');
		var position=_C(exchange.GetPosition);
		//Log(contract_min[$.get_exchange_id(exchange)]);
		//建仓
		if (positions_duo.length===0){
			records = _C(exchange.GetRecords)
			ticker=_C(exchange.GetTicker)
            last=ticker.Last
			if (last<=lowest20 && upLine > ma144last && midLine >= ma144last){
				var fucount_duo=_N(position_unit*last/contract_min[$.get_exchange_id(exchange)],0);//每次交易时的合约份数
				if(records[records.length - 2].Close <= downLinepre && last <= downLine){// && last >= ma144last
					exchange.SetDirection("buy");
					var dealamount=$.perform_limited_order("buy",exchange,buyPrice,fucount_duo,false,"futures","buy");
					if (dealamount>0){
						var postionduo = {
							deal_date:_D(),
							amount:dealamount,
							price:buyPrice,
							stoploss_price:buyPrice-2*N,
							stopwin_price:buyPrice+3*N,
							mid_price:midLine,
							up_price:upLine
						};
						positions_duo.push(postionduo);
						bet_duo=1;

						var pos_details = {
							type:"期货做多建仓详情",
                            time:_D(),
                            RealAmount:dealamount,
                            WantAmount:fucount_duo,
                            RealPrice:buyPrice,
                            WantPrice:last,
                            Memo:""
						};
						if (trades_recorder){
                            trades.push(pos_details);
                        }
                        trade_count++;
					}
				}
			}
		}
		if (positions_kong.length===0){
			records = _C(exchange.GetRecords)
			ticker=_C(exchange.GetTicker)
            last=ticker.Last
			if (last>=highest20 && downLine < ma144last && midLine <= ma144last){
				var fucount_kong=_N(position_unit*last/contract_min[$.get_exchange_id(exchange)],0);//每次交易时的合约份数
				if((records[records.length - 2].Close > upLinepre || (records[records.length - 2].Close <= upLinepre && records[records.length - 2].Close >= midLinepre)) &&
				  ((last <= upLine && last > midLine) || last > upLine)){// && last <= ma144last
					exchange.SetDirection("sell");
					var dealamount=$.perform_limited_order("buy",exchange,sellPrice,fucount_kong,false,"futures","sell");
					if (dealamount>0){
						var postionkong = {
							deal_date:_D(),
							amount:dealamount, 
							price:sellPrice,
							stoploss_price:sellPrice+2*N,
							stopwin_price:sellPrice-3*N,
							mid_price:midLine,
							down_price:downLine
						};
						positions_kong.push(postionkong);
						bet_kong=1;

						var pos_details = {
							type:"期货做空建仓详情",
                            time:_D(),
                            RealAmount:dealamount,
                            WantAmount:fucount_kong,
                            RealPrice:sellPrice,
                            WantPrice:last,
                            Memo:""
						};
						if (trades_recorder){
                            trades.push(pos_details);
                        }
                        trade_count++;
					}
				}
			}
		}
		//加仓
		if (positions_duo.length>0){
			var last_price=positions_duo[positions_duo.length-1].price;
			ticker=_C(exchange.GetTicker)
            last=ticker.Last
			if (bet_duo<max_positions){
				if (last-last_price>=0.5*N){
					var fucount_duo=_N(position_unit*last/contract_min[$.get_exchange_id(exchange)],0);
					exchange.SetDirection("buy");
					var dealamount=$.perform_limited_order("buy",exchange,buyPrice,fucount_duo,false,"futures","buy");
					if (dealamount>0){
						var postion = {
							deal_date:_D(),
							amount:dealamount, 
							price:buyPrice,
							stoploss_price:buyPrice-2*N,
							stopwin_price:buyPrice+3*N,
							mid_price:midLine,
							up_price:upLine
						};
						positions_duo.push(postion);
						bet_duo+=1;
						var pos_details = {
							type:"期货做多加仓详情",
                            time:_D(),
                            RealAmount:dealamount,
                            WantAmount:fucount_duo,
                            RealPrice:buyPrice,
                            WantPrice:last,
                            Memo:""
						};
						if (trades_recorder){
                            trades.push(pos_details);
                        }
                        trade_count++;
					}
				}
			}
		}
		if (positions_kong.length>0){
			var last_price=positions_kong[positions_kong.length-1].price;
			ticker=_C(exchange.GetTicker)
            last=ticker.Last
			if (bet_kong<max_positions){
				if (last_price-last>=0.5*N){
					var fucount_kong=_N(position_unit*last/contract_min[$.get_exchange_id(exchange)],0);
					exchange.SetDirection("sell");
					var dealamount=$.perform_limited_order("buy",exchange,sellPrice,fucount_kong,false,"futures","sell");
					if (dealamount>0){
						var postion = {
							deal_date:_D(),
							amount:dealamount, 
							price:sellPrice,
							stoploss_price:sellPrice+2*N,
							stopwin_price:sellPrice-3*N,
							mid_price:midLine,
							down_price:downLine
						};
						positions_kong.push(postion);
						bet_kong+=1;
						var pos_details = {
							type:"期货做空加仓详情",
                            time:_D(),
                            RealAmount:dealamount,
                            WantAmount:fucount_kong,
                            RealPrice:sellPrice,
                            WantPrice:last,
                            Memo:""
						};
						if (trades_recorder){
                            trades.push(pos_details);
                        }
                        trade_count++;
					}
				}
			}
		}
		//止损
		if (positions_duo.length>0){
			var positions_duo_new=[];
			ticker=_C(exchange.GetTicker)
            last=ticker.Last
			for (var i=0; i < positions_duo.length; i++){
				if (last<positions_duo[i].stoploss_price){// && last >= ma144last
					exchange.SetDirection("closebuy");
					$.perform_limited_order("sell",exchange,sellPrice,positions_duo[i].amount,true,"futures","closebuy");
					var detailloss = {
                        type:"期货做多止损",
                        time:_D(),
                        RealAmount:-1,
                        WantAmount:positions_duo[i].amount,
                        RealPrice:-1,
                        WantPrice:sellPrice,
                        Memo:(last > positions_duo[i].price?"盈利":"亏损")
                    };
                    if (trades_recorder){
                        trades.push(detailloss);
                    }
                    if(detailloss.Memo === "盈利"){
                        profitnum++;
                        profit_sum += _N(detailloss.WantPrice * detailloss.WantAmount * (1-fee) - positions_duo[i].price * detailloss.WantAmount * (1 - fee),3);
                        pr_co_sum += _N(profit_sum / last,3);
                    }else{
                        lossnum++;
                        loss_sum += Math.abs(_N((detailloss.WantPrice * detailloss.WantAmount * (1-fee) - positions_duo[i].price * detailloss.WantAmount * (1 - fee)),3));
                        lo_co_sum += _N(loss_sum / last,3);
                    }
                    trade_count++;
				}else{
					positions_duo_new.push(positions_duo[i]);
				}
			}
			positions_duo=positions_duo_new;
		}
		if (positions_kong.length>0){
			var positions_kong_new=[];
			ticker=_C(exchange.GetTicker)
            last=ticker.Last
			for (var i=0; i < positions_kong.length; i++){
				if (last>=positions_kong[i].stoploss_price){// && last <= ma144last
					exchange.SetDirection("closesell");
					$.perform_limited_order("sell",exchange,buyPrice,positions_kong[i].amount,true,"futures","closesell");
					var detailloss = {
                        type:"期货做空止损",
                        time:_D(),
                        RealAmount:-1,
                        WantAmount:positions_kong[i].amount,
                        RealPrice:-1,
                        WantPrice:buyPrice,
                        Memo:(last < positions_kong[i].price?"盈利":"亏损")
                    };
                    if (trades_recorder){
                        trades.push(detailloss);
                    }
                    if(detailloss.Memo === "盈利"){
                        profitnum++;
                        profit_sum += Math.abs(_N(detailloss.WantPrice * detailloss.WantAmount * (1-fee) - positions_kong[i].price * detailloss.WantAmount * (1 - fee),3));
                        pr_co_sum += _N(profit_sum / last,3);
                    }else{
                        lossnum++;
                        loss_sum += Math.abs(_N((detailloss.WantPrice * detailloss.WantAmount * (1-fee) - positions_kong[i].price * detailloss.WantAmount * (1 - fee)),3));
                        lo_co_sum += _N(loss_sum / last,3);
                    }
                    trade_count++;
				}else{
					positions_kong_new.push(positions_kong[i]);
				}
			}
			positions_kong=positions_kong_new;
		}
		//止盈
		if (positions_duo.length>0){
			var positions_duo_new=[];
			upLine = _N(boll[0][boll[0].length - 1],2);
			midLine = _N(boll[1][boll[1].length - 1],2);
			ticker=_C(exchange.GetTicker);
            last=ticker.Last;
			for (var i=0; i < positions_duo.length; i++){
				if (last>=positions_duo[i].stopwin_price && (last <= (midLine - 0.5* N) ||last <= (upLine - 0.5* N)) && last > positions_duo[i].up_price){
					exchange.SetDirection("closebuy");
					$.perform_limited_order("sell",exchange,sellPrice,positions_duo[i].amount,true,"futures","closebuy");
					var detailloss = {
                        type:"期货做多止盈",
                        time:_D(),
                        RealAmount:-1,
                        WantAmount:positions_duo[i].amount,
                        RealPrice:-1,
                        WantPrice:sellPrice,
                        Memo:(last > positions_duo[i].price?"盈利":"亏损")
                    };
                    if (trades_recorder){
                        trades.push(detailloss);
                    }
                    if(detailloss.Memo === "盈利"){
                        profitnum++;
                        profit_sum += _N(detailloss.WantPrice * detailloss.WantAmount * (1-fee) - positions_duo[i].price * detailloss.WantAmount * (1 - fee),3);
                        pr_co_sum += _N(profit_sum / last,3);
                    }else{
                        lossnum++;
                        loss_sum += _N((detailloss.WantPrice * detailloss.WantAmount * (1-fee) - positions_duo[i].price * detailloss.WantAmount * (1 - fee)),3);
                        lo_co_sum += _N(loss_sum / last,3);
                    }
                    trade_count++;
				}else{
					positions_duo_new.push(positions_duo[i]);
				}
			}
			positions_duo=positions_duo_new;
		}
		if (positions_kong.length>0){
			var positions_kong_new=[];
			midLine = _N(boll[1][boll[1].length - 1],2);
			downLine = _N(boll[2][boll[2].length - 1],2);
			ticker=_C(exchange.GetTicker);
            last=ticker.Last;
			for (var i=0; i < positions_kong.length; i++){
				if (last<=positions_kong[i].stopwin_price && (last >= (midLine + 0.5*N) || last >= (downLine + 0.5*N)) && last < positions_kong[i].down_price){
					exchange.SetDirection("closesell");
					$.perform_limited_order("sell",exchange,buyPrice,positions_kong[i].amount,true,"futures","closesell");
					var detailloss = {
                        type:"期货做空止盈",
                        time:_D(),
                        RealAmount:-1,
                        WantAmount:positions_kong[i].amount,
                        RealPrice:-1,
                        WantPrice:buyPrice,
                        Memo:(last < positions_kong[i].price?"盈利":"亏损")
                    };
                    if (trades_recorder){
                        trades.push(detailloss);
                    }
                    if(detailloss.Memo === "盈利"){
                        profitnum++;
                        profit_sum += Math.abs(_N(detailloss.WantPrice * detailloss.WantAmount * (1-fee) - positions_kong[i].price * detailloss.WantAmount * (1 - fee),3));
                        pr_co_sum += _N(profit_sum / last,3);
                    }else{
                        lossnum++;
                        loss_sum += Math.abs(_N((detailloss.WantPrice * detailloss.WantAmount * (1-fee) - positions_kong[i].price * detailloss.WantAmount * (1 - fee)),3));
                        lo_co_sum += _N(loss_sum / last,3);
                    }
                    trade_count++;
				}else{
					positions_kong_new.push(positions_kong[i]);
				}
			}
			positions_kong=positions_kong_new;
		}
		//清仓
		/**if (positions_duo.length>0){
			ticker=_C(exchange.GetTicker);
            last=ticker.Last;
			if (last>=highest10){
				for (var i=0; i < positions_duo.length; i++){
					exchange.SetDirection("closebuy");
					$.perform_limited_order("sell",exchange,last,positions_duo[i].amount,true,"futures","closebuy");
					var detailloss = {
                        type:"期货做多清仓",
                        time:_D(),
                        RealAmount:-1,
                        WantAmount:positions_duo[i].amount,
                        RealPrice:-1,
                        WantPrice:sellPrice,
                        Memo:(last > positions_duo[i].price?"盈利":"亏损")
                    };
                    if (trades_recorder){
                        trades.push(detailloss);
                    }
                    if(detailloss.Memo === "盈利"){
                        profitnum++;
                        profit_sum += _N(detailloss.WantPrice * detailloss.WantAmount * (1-fee) - positions_duo[i].price * detailloss.WantAmount * (1 - fee),3);
                        pr_co_sum += _N(profit_sum / last,3);
                    }else{
                        lossnum++;
                        loss_sum += Math.abs(_N((detailloss.WantPrice * detailloss.WantAmount * (1-fee) - positions_duo[i].price * detailloss.WantAmount * (1 - fee)),3));
                        lo_co_sum += _N(loss_sum / last,3);
                    }
                    trade_count++;
				}
				positions_duo=[];
			}
		}
		if (positions_kong.length>0){
			ticker=_C(exchange.GetTicker);
            last=ticker.Last;
			if (last<=lowest10){
				for (var i=0; i < positions_kong.length; i++){
					exchange.SetDirection("closesell");
					$.perform_limited_order("sell",exchange,last,positions_kong[i].amount,true,"futures","closesell");
					var detailloss = {
                        type:"期货做空清仓",
                        time:_D(),
                        RealAmount:-1,
                        WantAmount:positions_kong[i].amount,
                        RealPrice:-1,
                        WantPrice:buyPrice,
                        Memo:(last < positions_kong[i].price?"盈利":"亏损")
                    };
                    if (trades_recorder){
                        trades.push(detailloss);
                    }
                    if(detailloss.Memo === "盈利"){
                        profitnum++;
                        profit_sum += Math.abs(_N(detailloss.WantPrice * detailloss.WantAmount * (1-fee) - positions_kong[i].price * detailloss.WantAmount * (1 - fee),3));
                        pr_co_sum += _N(profit_sum / last,3);
                    }else{
                        lossnum++;
                        loss_sum += Math.abs(_N((detailloss.WantPrice * detailloss.WantAmount * (1-fee) - positions_kong[i].price * detailloss.WantAmount * (1 - fee)),3));
                        lo_co_sum += _N(loss_sum / last,3);
                    }
                    trade_count++;
				}
				positions_kong=[];
			}
		}**/
		//交易所强平
		var current_position=_C(exchange.GetPosition);//must update here
		if (current_position.length===0){
			positions_duo=[];
			positions_kong=[];
		}

		if(profitnum > 0 && lossnum > 0){
            winrate = _N(profitnum / (profitnum + lossnum),4);// 计算胜率.
            winloss = _N(profit_sum / profitnum / Math.abs(loss_sum / lossnum));//计算盈亏比.
        }
		
		//chart
		var table={type: 'table', title: '期货交易详情-'+'('+currency+')', cols: ['交易所','平均波幅(N)','下单单位','最新价','盈利总金额','亏损总金额','盈利次数','亏损次数','总次数','胜率','盈亏比'], rows: []};
		var table1={type: 'table', title: '期货仓位-'+'('+currency+')', cols: ['交易所','买多仓位','卖空仓位','持仓量','冻结量','持仓均价','持仓盈亏','平仓盈亏','仓位占用的保证金','合约代码'], rows: []};
		var table2={type: 'table', title: '跟踪仓位-'+'('+currency+')', cols: ['交易所','成交时间','类型','成交数量','成交价格','止损价','止盈价'], rows: []};
		var table3={type: 'table', title:'期货交易历史-'+'('+currency+')',cols:['日期','类型', '成交数量','发单数量','成交价','发单价','备注'], rows: []};
		table.rows.push([exname,N,position_unit,last,_N(pr_co_sum,3),_N(lo_co_sum,3),profitnum,lossnum,trade_count, _N(winrate * 100,3) + '%',winloss])
		for (var i=0; i < current_position.length; i++){
				table1.rows.push([exname,
				positions_duo.length,
				positions_kong.length,
				current_position[i].Amount,
				current_position[i].FrozenAmount,
				_N(current_position[i].Price,3),
				_N(current_position[i].Profit,3),
				current_position[i].Type,
				_N(current_position[i].Margin,3),
				current_position[i].ContractType]);
			}
		for (i=0; i<positions_duo.length; ++i){
			table2.rows.push([exname,positions_duo[i].deal_date,'做多',positions_duo[i].amount,_N(positions_duo[i].price,3),
			_N(positions_duo[i].stoploss_price,3),_N(positions_duo[i].stopwin_price,3)]);
		}
		for (i=0; i<positions_kong.length; ++i){
			table2.rows.push([exname,positions_kong[i].deal_date,'做空',positions_kong[i].amount,positions_kong[i].price,
			_N(positions_kong[i].stoploss_price,3),_N(positions_kong[i].stopwin_price,3)]);
		}
		for (var p = 0; p < trades.length; p++){
            table3.rows.push([trades[p].time,trades[p].type,trades[p].RealAmount,trades[p].WantAmount,_N(trades[p].RealPrice,3),_N(trades[p].WantPrice,3),trades[p].Memo]);
        }
		LogStatus(
					'更新时间: '+_D(),"#8e2323"+'\n'+
					'`' + JSON.stringify([table,table1,table2,table3])+'`'+'\n'+
					'前20周期最高价:'+highest20,"#d98719"+'\n'+'=================='+'前10周期最高价:'+highest10,"#a68064"+'\n'+
					'前20周期最低价:'+lowest20,"#d98719"+'\n'+'=================='+'前10周期最低价:'+lowest10,"#a68064"+'\n'+
					'轮询次数: '+total_loop+'\n'+
					'TMOS期货交易策略<<布林通道与144匀线组合>>利用移步止损法实现小亏损,让利益奔跑 #ff0000'+'\n'
				  );
		//if (total_loop%300===0){
			//LogProfit(account.Stocks);
		//}
		
		Sleep(wait_ms);
		total_loop++;
	}
}