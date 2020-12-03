// SPDX-License-Identifier: MIT
/**
  @TZMOS 团队开发基于以太坊的ERC20_TOKEN标准接口协议，开发“TMOS”激励型的TOKEN代币。
  关于ERC20_TOKEN标准接口协议所需要的下方函数必须完全给实现。
 */
pragma solidity^0.7.4;

interface IERC20 {
    
  function totalSupply() external view returns (uint256);

  function balanceOf(address who) external view returns (uint256);

  function allowance(address owner, address spender)
    external view returns (uint256);

  function transfer(address to, uint256 value) external returns (bool);

  function approve(address spender, uint256 value)
    external returns (bool);

  function transferFrom(address from, address to, uint256 value)
    external returns (bool);

  event Transfer(
    address indexed from,
    address indexed to,
    uint256 value
  );

  event Approval(
    address indexed owner,
    address indexed spender,
    uint256 value
  );
}