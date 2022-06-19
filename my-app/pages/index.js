import { BigNumber, Contract, ethers, providers, utils } from "ethers";
import Head from "next/head";
import React, { useEffect, useRef, useState } from "react";
import Web3Modal from "web3modal";
import { abi, RANDOM_GAME_NFT_CONTRACT_ADDRESS } from "../constants";
import { FETCH_CREATED_GAME } from "../queries";
import styles from "../styles/Home.module.css";
import { subgraphQuery } from "../utils";

export default function Home() {
  const zero = BigNumber.from("0");
  //walletConnected keeps track of whether user's wallet connected or not
  const [walletConnected, setWalletConnected] = useState(false);
  //waiting for a txn to get mined
  const [loading, setLoading] = useState(false);
  //boolean to keep track of whether current connected account is owner
  const [isOwner, setIsOwner] = useState(false);
  const [entryFee, setEntryFee] = useState(zero);
  const [maxPlayers, setMaxPlayers] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [players, setPlayers] = useState([]);
  const [winner, setWinner] = useState();
  const [logs, setLogs] = useState([]);
  //Reference to the Web3Modal (used for connecting to Metamask), persists as long as page open
  const Web3ModalRef = useRef();

  //this forces react to re-render the page when we want to
  //will be used to show new logs
  const forceUpdate = React.useReducer(() => ({}), {})[1]

  //getProviderOrSigner is an async function that takes in a needSigner (default false)
  //returns a provider (read) or signer (write)

  const getProviderOrSigner = async (needSigner = false) => {
    //Connect to Metamask
    //Since web3Modal is a reference, we must access 'current' value to get object
    const provider = await Web3ModalRef.current.connect()
    //our provider uses 'providers.Web3Provider' and supplies provider above
    const Web3Provider = new providers.Web3Provider(provider);

    //check if user is connected to mumbai
    const {chainId} = await Web3Provider.getNetwork();
    if (chainId !== 80001) {
      window.alert("Change network to Mumbai");
      throw new Error("Change network to Mumbai")
    }
    //if we do need to make write txn
    if (needSigner) {
      //call .getSigner on our Web3Provider
      const signer = Web3Provider.getSigner();
      return signer;
    }
    return Web3Provider;
  }

  //connectWallet is an asynchronous function to connect a wallet
  const connectWallet = async () => {
    //encapsulate in try block
    try {
      //call our provider/signer function
      await getProviderOrSigner();
      //set wallet connected state variable to true
      setWalletConnected(true);
    } catch(err) {
      //log an errors
      console.error(err)
    }
  }

  const startGame = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      
      //here we connect to our contract by creating a new instance
      //takes in an address, abi, and a signer (in this case)
      const randomGameNFTContract = new Contract(
        RANDOM_GAME_NFT_CONTRACT_ADDRESS,
        abi,
        signer
      );
      setLoading(true);
      
      const tx = await randomGameNFTContract.startGame(maxPlayers, entryFee);
      await tx.wait();
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const joinGame = async() => {
    try {
      const signer = await getProviderOrSigner(true);

      const randomGameNFTContract = new Contract(
        RANDOM_GAME_NFT_CONTRACT_ADDRESS,
        abi,
        signer
      );

      //we have to setLoading to true since its a tx, and it'll take time
      setLoading(true);
      const tx = await randomGameNFTContract.joinGame({
        value: entryFee
      })
      await tx.wait();
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const checkIfGameStarted = async () => {
    try {
      const provider = await getProviderOrSigner();

      const randomGameNFTContract = new Contract(
        RANDOM_GAME_NFT_CONTRACT_ADDRESS,
        abi,
        provider
      );
      
      const _gameStarted = randomGameNFTContract.gameStarted();

      const _gameArray = await subgraphQuery(FETCH_CREATED_GAME());
      //here, we get the current game via the query
      const _game = _gameArray.games[0];
      let _logs = [];
      
      //here we init the logs and query the graph for the current gameID
      if (_gameStarted) {
        _logs = [`Game has started with ID: ${_game.id}`];
        if (_game.players && _game.players.length > 0) {
          _logs.push(
            `${_game.players.length} / ${_game.maxPlayers} already joined`
          );
          _game.players.forEach((player) => {
            _logs.push(`${player} joined`)
          });
        }
        setEntryFee(BigNumber.from(_game.entryFee));
        setMaxPlayers(_game.maxPlayers);
      } else if (!gameStarted && _game.winner) {
        _logs = [
          `Last game has ended with ID: ${_game.id}`,
          `Winner is: ${_game.winner}`,
          `Waiting for host to start new game...`,
        ];
        setWinner(_game.winner);
      }
      setLogs(_logs);
      setPlayers(_game.players);
      setGameStarted(_gameStarted);
      forceUpdate();
    } catch(error) {
      console.error(error);
    }
  };

  const getOwner = async () => {
    try {
      const provider = await getProviderOrSigner();

      const randomGameNFTContract = new Contract (
        RANDOM_GAME_NFT_CONTRACT_ADDRESS,
        abi,
        provider
      );
      
      //getting the contract's owner
      const _owner = await randomGameNFTContract.owner();

      //getting the signer allows us to extract the address
      const signer = await getProviderOrSigner(true);
      const address = await signer.getAddress();

      if (address.toLowerCase() == _owner.toLowerCase()) {
        setIsOwner(true);
      }
    } catch(err) {
      console.error(err)
    }
  };

  //useEffect used to react to changes to state of website
  //in this case, if walletConnected changes

  useEffect(() => {
    if (!walletConnected) {
      Web3ModalRef.current = new Web3Modal({
        network: "mumbai",
        providerOptions: {},
        disableInjectedProvider: false,
      });
      connectWallet();
      getOwner();
      checkIfGameStarted();
      setInterval(() => {
        checkIfGameStarted();
      }, 2000);
    }
  }, [walletConnected])

  const renderButton = () => {
    //if wallet not connected, we return a button that will allow them to connect their wallet
    if (!walletConnected) {
      return (
        <button onClick={connectWallet} className={styles.button}>
          Connect your wallet
        </button>
      );
    }

    if (loading) {
      return <button className={styles.button}>Loading...</button>;
    }

  
    if (gameStarted) {
      if (players.length == maxPlayers) {
        return (
          <button className = {styles.button} disabled>
            Choosing winner...
          </button>
        );
      }
      return (
        <div>
          <button className={styles.button} onClick={joinGame}>
            Join Game
          </button>
        </div>
      );
    }

    if (isOwner && !gameStarted) {
      return (
        <div>
          <input
            type="number"
            className={styles.input}
            onChange={(e) => {
              //user enters value in ether, so need to convert to WEI
              setEntryFee(
                //if true, then we do execute the first expression after '?'
                e.target.value >= 0
                ? utils.parseEther(e.target.value.toString())
                : zero
              );
            }}
            placeholder="Entry Fee (ETH)"
          />
          <input 
            type="number"
            className={styles.input}
            onChange={(e) => {
              //if null, evaluate to 0
              setMaxPlayers(e.target.value ?? 0);
            }}
            placeholder="Max players"
          />
          <button className={styles.button} onClick={startGame}>
            Start Game 🚀
          </button>
        </div>
      );
    }
  };

  return (
    <div>
      <Head>
        <title>Harry's Random Winner Game</title>
        <meta name="description" content="Harry's-Random-Winner-dApp"/>
        <link rel="icon" href="./favicon.ico"/>
      </Head>
      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to Harry's Random Winner Game!</h1>
          <div className={styles.description}>
            Its a lottery game where a winner is chosen at random and wins the
            entire pool - made for my fellow gambling degens
        </div>
        {renderButton()}
        {logs &&
            logs.map((log, index) => (
              <div className={styles.log} key={index}>
                {log}
              </div>
            ))}
        </div>
        <div>
          <img className={styles.image} src="./randomWinner.png" />
        </div>
      </div>
      <footer className={styles.footer}>
        Made with &#10084; Harry
      </footer>
    </div>
  )
}