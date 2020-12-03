// SPDX-License-Identifier: MIT
pragma solidity^0.7.4;

import "./IERC20.sol";
import "./SafeMath.sol";
/**
    此合约调用了ERC20接口与安全库
*/
contract TMOS is IERC20 {
    using SafeMath for uint256;//对uint256类型使用安全计算 
    string private _name;
    string private _symbol;
    uint8 private _decimals;
    uint256 private _totalSupply;
    address private admin;
    mapping(address=>uint256) private _balances;
    mapping(address=>mapping(address=>uint256)) private _allowance;
    constructor(string memory name, string memory symbol) public {
        _name = name;
        _symbol = symbol;
        _decimals = 18;
        _totalSupply = 0;
        admin = msg.sender;
    }
    //查看代币名称
    function name() external view returns (string memory) {
        return _name;
    }
    //查看代币符号
    function symbol() external view returns(string memory){
        return _symbol;
    }
    //查看代币小数位
    function decimals() external view returns(uint8){
        return _decimals;
    }
    //挖矿函数
    function mint(address to, uint256 value) external {
        require(admin == msg.sender, "only admin can do!");
        require(address(0) != to, "to must an address");
        beforeTokenTransfer(address(0), to, value);
        _balances[to] = _balances[to].add(value);
        _totalSupply = _totalSupply.add(value);
        emit Transfer(address(0), to, value);
    }
    // 总发行量
    function totalSupply() external override view returns (uint256) {
        return _totalSupply;
    }
    //查寻余额
    function balanceOf(address who) external override view returns (uint256) {
          return _balances[who];
    }

    function allowance(address owner, address spender)
    external override view returns (uint256) {
        return _allowance[owner][spender];
    }
    // 转账
    function transfer(address to, uint256 value) external override returns (bool) {
        require(value >0, "value must > 0");
        require(_balances[msg.sender] >= value, "balance must enough!");
        require(address(0) != to, "to must an address");
        beforeTokenTransfer(msg.sender, to, value);
        _balances[msg.sender] = _balances[msg.sender].sub(value);
        _balances[to] = _balances[to].add(value);
        emit Transfer(msg.sender, to, value);
    }
    //授权
    function approve(address spender, uint256 value)
    external override returns (bool) {
        //require(value >0, "value must > 0");
        require(_balances[msg.sender] >= value, "balance must enough!");
        require(address(0) != spender, "spender must an address");
        _allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
    }
    //授权后进行转帐操作
    function transferFrom(address from, address to, uint256 value)
    external override returns (bool) {
        require(address(0) != to, "to must an address");
        require(value >0, "value must > 0");
        require(_allowance[from][to] >= value, "allowance's value must enough!");
        beforeTokenTransfer(from, to, value);
        _allowance[from][to] = _allowance[from][to].sub(value);
        _balances[from] = _balances[from].sub(value);
        _balances[to] = _balances[to].add(value);
        emit Transfer(from, to, value);
    }
    //代币销毁操作
    function burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");

        beforeTokenTransfer(account, address(0), amount);

        _balances[account] = _balances[account].sub(amount, "ERC20: burn amount exceeds balance");
        _totalSupply = _totalSupply.sub(amount);
        emit Transfer(account, address(0), amount);
    }
    function _setupDecimals(uint8 decimals) internal {
        _decimals = decimals;
    }
    //转帐之前的代币数量
    function beforeTokenTransfer(address from, address to, uint256 amount) internal virtual { }
}