pragma solidity ^0.7.0;

contract tmosToken{
    //变量：代币名称，代币符号，总发行量，小数位（18位的uint）
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint public totalSupply;
    //持币者的余额列表与副卡列表
    mapping (address=>uint) public balanceOf;
    mapping (address=>mapping (address=>uint)) public approveOf;

    //事件：转帐事件，批准副卡事件，销毁事件（用来抵消通货膨胀）
    event Transfer(address indexed from, address indexed to, uint value );
    event Approve(address indexed owner, address indexed active, uint value);
    event Burn(address indexed from, uint value);
    //合约构造器(相当于函数初始化)
    constructor (uint initSupply, string memory tokenName, string memory tokenSymbol) public {
        
        totalSupply = initSupply * 10 ** decimals;
        balanceOf[msg.sender] = totalSupply;
        name = tokenName;
        symbol = tokenSymbol;
        
    }
    //内部转账动作
    function _transfer(address from, address to, uint value) internal{
        //防止给空地址转帐
        require(to != address(0x0));
        //进行余额检查
        require(balanceOf[from] >= value);
        //防止溢出检查
        require(balanceOf[to] + value >= balanceOf[to]);
        //总帐平衡检查（帐是平的）
        uint pre_total_balence = balanceOf[from] + balanceOf[to];
        balanceOf[from] -= value;
        balanceOf[to] += value;
        assert(balanceOf[from] + balanceOf[to] == pre_total_balence);
        emit Transfer(from, to, value);


    }
    //发币者的转帐
    function transfer(address to, uint value) public returns(bool){
        _transfer(msg.sender, to, value * 10 ** decimals);
        return true;
    }
    //发行者向副卡持有者批准副卡金额
    function approve(address active,uint value) public returns (bool){
        approveOf[active][msg.sender] = value * 10 ** decimals;
        emit Approve(msg.sender,active,value * 10 ** decimals);
        return true;
        
    }
    //其他人之间的转帐（相当于所有副卡之间的转帐）
    function transfer_approve(address from, address to, uint value) public payable returns (bool){
        require(value <= approveOf[from][msg.sender]);
        approveOf[from][msg.sender] -= value * 10 ** decimals;
        _transfer(from, to, value * 10 ** decimals);
        return true;
    }
    //主卡销毁动作
    function burn(uint value) public returns (bool) {
        require(balanceOf[msg.sender] >= value * 10 ** decimals);
        balanceOf[msg.sender] -= value * 10 ** decimals;
        totalSupply -= value * 10 ** decimals;
        emit Burn(msg.sender,value * 10 ** decimals);
        return true;
        
    }
    //被批准的副卡销毁动作
    function burn_from(address from, uint value) public returns (bool) {
        require(balanceOf[msg.sender] >= value * 10 ** decimals);
        require(approveOf[from][msg.sender] >= value * 10 ** decimals);
        balanceOf[from] -= value * 10 ** decimals;
        approveOf[from][msg.sender] -= value * 10 ** decimals;
        totalSupply -= value * 10 ** decimals;
        emit Burn(from,value * 10 ** decimals);
        return true;
    }


}