// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {OpenVenueDesk} from "../src/OpenVenueDesk.sol";

contract DeployOpenVenueDesk is Script {
    function run() external returns (OpenVenueDesk desk) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        desk = new OpenVenueDesk();
        vm.stopBroadcast();
        console2.log("OpenVenueDesk", address(desk));
        console2.log("owner", desk.owner());
    }
}
