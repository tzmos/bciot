// fmz@9794b9e7fc00444f56261c32fe49e779
var price_n={Futures_OKCoin_BSV_USD:2,Futures_OKCoin_BTC_USD:8,Futures_OKCoin_ETH_USD:8};
var num_n={Futures_OKCoin_BSV_USD:0,Futures_OKCoin_BTC_USD:0,Futures_OKCoin_ETH_USD:0};
var minestbuy={Futures_OKCoin_BSV_USD:1,Futures_OKCoin_BTC_USD:0.001,Futures_OKCoin_ETH_USD:0.12};
var price_step={Futures_OKCoin_BSV_USD:0.05,Futures_OKCoin_BTC_USD:0.001,Futures_OKCoin_ETH_USD:0.12};
var wait_ms=3000;
var max_wait_order=15000;

$.set_params=function(_price_n,_num_n,_minestbuy,_price_step,_wait_ms,_max_wait_order){
	price_n=_price_n;
	num_n=_num_n;
	minestbuy=_minestbuy;
	price_step=_price_step;
	wait_ms=_wait_ms;
	max_wait_order=_max_wait_order;
}
$.get_exchange_id=function(ex){
	var currency=ex.GetCurrency();
	var exname=ex.GetName();
	return exname+"_"+currency;
}
$.retry_get_account=function(ex){
	var exname=ex.GetName();
	var account=_C(ex.GetAccount);
	if (exname === "Kraken"){
        account = _C(ex.GetAccount)
		var ret={
			Info:account.Info,
			Stocks:account.Stocks,
			FrozenStocks:0,
			Balance:account.Info.result.ZUSD,
			FrozenBalance:0
			};
		return ret;
	}else{
		account=_C(ex.GetAccount);
		return account;
	}
}
//订单买交易模板。调用时用$.retryBuy()函数
$.retryBuy=function(ex,price,num,mode){
    var account=_C(ex.GetAccount);
	if (num<minestbuy[$.get_exchange_id(ex)])// || account.Balance < price * num
	{
		Log($.get_exchange_id(ex)+":"+"买入"+num+"=>"+"低于最小交易量");//+"或者帐户余额小于"+price * num
		return null;
	}
	
	var r=ex.Buy(_N(price,price_n[$.get_exchange_id(ex)]), _N(num,num_n[$.get_exchange_id(ex)]));
	if (!r){
		Log("Buy失败，正在重试。");
		Sleep(wait_ms);
		if (mode==="spot"){//如果交易模式是现货，则执行下面代码
			account=$.retry_get_account(ex);
			var fixedAmount=Math.min(account.Balance/price,num);
			r=$.retryBuy(ex,price,fixedAmount,mode);
		}else if(mode==="futures"){//如果交易模式是期货，则执行下面代码
			r=$.retryBuy(ex,price,num,mode);
		}
	}
	return r;
}
//订单卖交易模板。调用时用$.retrySell()函数
$.retrySell=function(ex,price,num,mode,direction){
	if (num<minestbuy[$.get_exchange_id(ex)])
	{
		Log($.get_exchange_id(ex)+":"+"卖出"+num+"=>"+"低于最小交易量已忽略");
		return null;
	}
	
	var r=ex.Sell(_N(price,price_n[$.get_exchange_id(ex)]), _N(num,num_n[$.get_exchange_id(ex)]));
	if (!r){
		Log("Sell失败，正在重试。");
		Sleep(wait_ms);
		if (mode==="spot"){//如果交易模式是现货，则执行下面代码
			var account=$.retry_get_account(ex);
			var fixedAmountspot=Math.min(account.Stocks,num);
			r=$.retrySell(ex,price,fixedAmountspot,mode,direction);
		}else if(mode==="futures"){//如果交易模式是期货，则执行下面代码
			var position=_C(ex.GetPosition);
			if (position.length===0){
				Log("期货仓位已为空，已终止retrySell。");
				return null;
			}
            var totalzuoduo=0;
			var totalzuokong=0;
			for (var i=0; i < position.length; i++){
				if (position[i].Type===PD_LONG){
					totalzuoduo+=position[i].Amount;
				}
				if (position[i].Type===PD_SHORT){
					totalzuokong+=position[i].Amount;
				}
			}
			Log($.get_exchange_id(ex)+":"+"做多张数"+totalzuoduo+",做空张数"+totalzuokong);
			var fixedAmount=Math.min((direction==="closebuy"?totalzuoduo:totalzuokong),num);
			r=$.retrySell(ex,price,fixedAmount,mode,direction);
		}
	}
	return r;
}
/**$.get_ChinaTimeString=function(){
	var date = new Date(); 
	var now_utc =  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
	var cdate=new Date(now_utc);
	cdate.setHours(cdate.getHours()+8);
	var localstring=cdate.getFullYear()+'/'+(cdate.getMonth()+1)+'/'+cdate.getDate()+' '+cdate.getHours()+':'+cdate.getMinutes()+':'+cdate.getSeconds();
	return localstring;
}**/
$.retry_get_order=function(ex,order_id,otype){
	var orderdata=_C(ex.GetOrder,order_id);
	return orderdata;
}
//取消订单交易模板。调用时用$.retry_cancelorder()函数
$.retry_cancelorder=function(ex,order_id){
	Log("取消订单"+order_id);
	ex.CancelOrder(order_id);
	Sleep(500);
	var orders=_C(ex.GetOrders);
	var find=false;
	for (var i=0;i<orders.length;++i){
		if (orders[i].Id===order_id){
			find=true;
			break;
		}
	}
	if (find){
		$.retry_cancelorder(ex,order_id);
	}
}
/**
    根据交易类型限制订单交易量模板（调用时直接用导出函数$.perform_limited_order()）
**/
$.perform_limited_order=function(type,ex,price,num,must_complete,mode,direction){
	if (num<minestbuy[$.get_exchange_id(ex)]){
		return 0;
	}
	if (type==="buy"){
		var buyID=$.retryBuy(ex,price,num,mode);
		if (buyID===null)
			return 0;
		Sleep(max_wait_order);
		var orderbuy=$.retry_get_order(ex,buyID,type);
		if (!must_complete){
			if (orderbuy.DealAmount!==num){
				$.retry_cancelorder(ex,buyID);
			}
			Log($.get_exchange_id(ex)+"     "+type+" "+num+"(实际成交:"+orderbuy.DealAmount+")");
			return orderbuy.DealAmount;
		}else{
			if (orderbuy.DealAmount!==num){
				$.retry_cancelorder(ex,buyID);
				$.perform_limited_order(type,ex,price,num-orderbuy.DealAmount,must_complete,mode,direction);
			}
			Log($.get_exchange_id(ex)+"     "+type+" "+num+"(实际成交:"+num+")");
			return num;
		}
	}
	if (type==="sell"){
		var sellID=$.retrySell(ex,price,num,mode,direction);
		if (sellID===null)
			return 0;
		Sleep(max_wait_order);
		var ordersell=$.retry_get_order(ex,sellID,type);
		if (!must_complete){
			if (ordersell.DealAmount!==num){
				$.retry_cancelorder(ex,sellID);
			}
			Log($.get_exchange_id(ex)+"     "+type+" "+num+"(实际成交:"+ordersell.DealAmount+")");
			return ordersell.DealAmount;
		}else{
			if (ordersell.DealAmount!==num){
				$.retry_cancelorder(ex,sellID);
				$.perform_limited_order(type,ex,price,num-ordersell.DealAmount,must_complete,mode,direction);
			}
			Log($.get_exchange_id(ex)+"     "+type+" "+num+"(实际成交:"+num+")");
			return num;
		}
	}
}