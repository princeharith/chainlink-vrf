// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";

contract RandomWinnerGame is VRFConsumerBase, Ownable {
    //Chainlink variables

    //The amount of LINK to send w/ a request
    uint256 public fee;
    //ID of public key with which randomness is generated
    bytes32 public keyHash;

    //Address of the players
    address[] public players;
    //Max number of players in one game
    uint8 maxPlayers;
    //Variable to indicate if game started or not
    bool public gameStarted;
    //fees for entering game
    uint256 public entryFee;
    //current game id
    uint256 public gameId;

    //emitted once game starts
    event GameStarted(uint256 gameId, uint8 maxPlayers, uint256 entryFee);
    //emitted when someone joins a game
    event PlayerJoined(uint256 gameId, address player);
    //emitted when game ends
    event GameEnded(uint256 gameId, address winner, bytes32 requestId);

    /**
    constructor inherits a VRFConsumerBase and initiates the values for keyHash, fee and gameStarted
    @param vrfCoordinator address of VRFCoordinator contract
    @param linkToken address of LINK token contract
    @param vrfFee the amount of LINK to send with request
    @param vrfKeyHash ID of public key with which randomness is generated
    */

    constructor(
        address vrfCoordinator,
        address linkToken,
        uint256 vrfFee,
        bytes32 vrfKeyHash
    ) VRFConsumerBase(vrfCoordinator, linkToken) {
        keyHash = vrfKeyHash;
        fee = vrfFee;
        gameStarted = false;
    }

    /**
    startGame starts game by setting appropriate values for all vars
    */
    function startGame(uint8 _maxPlayers, uint256 _entryFee) public onlyOwner {
        //Check if game already running
        require(!gameStarted, "The game has already started");
        //empty the players array
        delete players;
        //set max players for the game
        maxPlayers = _maxPlayers;
        //set game started to true
        gameStarted = true;
        //set entryFee for game
        entryFee = _entryFee;
        gameId += 1;
        emit GameStarted(gameId, maxPlayers, entryFee);
    }

    /**
    joinGame is called when player wants to join the game
    */
    function joinGame() public payable {
        //Make sure game is running
        require(gameStarted, "Game is not running yet");
        //Check if value sent matches entry fee
        require(msg.value == entryFee, "Not enough ether sent for entry fee");
        //Check if there is space left for another player
        require(
            players.length < maxPlayers,
            "There are already enough players"
        );

        //add sender to player list
        players.push(msg.sender);
        emit PlayerJoined(gameId, msg.sender);
        //If list is full, start the random winner selection process
        if (players.length == maxPlayers) {
            getRandomWinner();
        }
    }

    /**
    fulfillRandomness is called by VRFCoordinator when it receives a valid VRF proof.
    This is overrided to act upon the random number generated by Chainlink VRF
    @param requestId this ID is unique for the request we sent to VRF Coordinator
    @param randomness this is a random uint256 generated and returned to us by the VRF coordinator
    */

    function fulfillRandomness(bytes32 requestId, uint256 randomness)
        internal
        virtual
        override
    {
        //We want index of winner to be in length from 0 to players.length-1
        //Thus, we mod with player.length
        uint256 winnerIndex = randomness % players.length;
        //get the address of the winner
        address winner = players[winnerIndex];
        //send ether in contract to winner
        (bool sent, ) = winner.call{value: address(this).balance}("");
        require(sent, "Failed to sent ether to the winner");
        //Emit that game ended
        emit GameEnded(gameId, winner, requestId);
        //set gameStarted to false
        gameStarted = false;
    }

    /**
    getRandomWinner called to start process of selecting a random winner
    */
    function getRandomWinner() private returns (bytes32 requestId) {
        //LINK is an internal interface for Link token found w/in VRFConsumerBase
        //We use the balanceOf method from that interface to make sure contract
        //has enough Link so we can request the VRFCoordinator for randomness
        require(LINK.balanceOf(address(this)) >= fee, "Not enough LINK");
        //Make request to VRF Coordinator
        //requestRandomness is a function w/in the VRFConsumerBase
        //this kicks off the process for randomness generation
        return requestRandomness(keyHash, fee);
    }

    receive() external payable {}

    //when msg.data not empty
    fallback() external payable {}
}
