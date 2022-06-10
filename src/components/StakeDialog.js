import React, { useEffect, useState } from 'react';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import TextField from '@material-ui/core/TextField';
import { refreshWalletPublicKeys, useWallet, useWalletTokenAccounts } from '../utils/wallet';
import * as web3 from '@solana/web3.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { makeStyles, Tab, Tabs } from '@material-ui/core';
import { useSendTransaction } from '../utils/notifications';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import { abbreviateAddress } from '../utils/utils';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import Collapse from '@material-ui/core/Collapse';
import { useConnection, useSolanaExplorerUrlSuffix } from '../utils/connection';
import Link from '@material-ui/core/Link';
import CopyableDisplay from './CopyableDisplay';
import DialogForm from './DialogForm';
import TokenIcon from './TokenIcon';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import InputLabel from '@material-ui/core/InputLabel';

const useStyles = makeStyles((theme) => ({
  tabs: {
    marginBottom: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.background.paper}`,
  },
}));

export default function StakeDialog({ open, onClose }) {
  const wallet = useWallet();
  const connection = useConnection();

  let classes = useStyles();

  const [sendTransaction, sending] = useSendTransaction();

  const [walletAccounts] = useWalletTokenAccounts();
  const [tab, setTab] = useState('newstake');
  const [stakeAccount, setStakeAccount] = useState('');
  const [StakeAccountaddr, setStakeAccountaddr] = useState(''); //diff used for withdraw&unstake
  const [validatoraddress, setvalidatoraddress] = useState('');
  const [withdrawaddress, setwithdrawaddress] = useState('');
  const [amount, setAmount] = useState('');
  // note Amount -- same var in stake and unstake
  const [validators, setValidators] = useState([]);

  async function update_validators() {
    let rawvoteAccounts = await connection.getVoteAccounts();
    let votepubkeys = [];
    rawvoteAccounts.current.map((v, i) => votepubkeys.push(v.votePubkey));
    setValidators(votepubkeys);
  }

  function newStakeAccount() {
    const stakeAccount = new web3.Account();
    setStakeAccount(stakeAccount);
    //return stakeAccount.publicKey.toString();
  }

  function onSubmit({ stakeAccount, validatoraddress, withdrawaddress, amount, StakeAccountaddr }) {
    if (tab === 'newstake') {
      //newstake(stakeAccount, amount, validatoraddress);
      //console.log(validators);
      sendTransaction(newstake(stakeAccount, amount, validatoraddress), {
        onSuccess: () => {
          refreshWalletPublicKeys(wallet);
          onClose();
        },
      });
    } else if (tab === 'unstake') {
      sendTransaction(unstake(StakeAccountaddr), {
        onSuccess: () => {
          refreshWalletPublicKeys(wallet);
          onClose();
        },
      });
    } else if (tab === 'withdraw') {
      sendTransaction(withdrawstake(StakeAccountaddr, amount, withdrawaddress), {
        onSuccess: () => {
          refreshWalletPublicKeys(wallet);
          onClose();
        },
      });
    }
    else if (tab === 'onlydelegatestake') {
      sendTransaction(onlydelegatestake(StakeAccountaddr, amount, validatoraddress), {
        onSuccess: () => {
          refreshWalletPublicKeys(wallet);
          onClose();
        },
      });
    }
  }

  useEffect(() => {
    // fetch token files
    (async () => {
      let rawvoteAccounts = await connection.getVoteAccounts();
      let votepubkeys = [];
      rawvoteAccounts.current.map((v, i) => votepubkeys.push(v.votePubkey));
      setValidators(votepubkeys);
    })();
  }, [connection]);

  async function newstake(stakeAccount, amount, validatoraddress) {

    // convert parameters to required types -- stakeaccount, amount, validatoraddress
    // 1. create stake account with stakeaccount pubkey & amount
    // 2. delegate to validator's vote account the amount

    // create new stake account, from--walletpubkey
    // authorized (stakeauth, withdrawauth) -- both set to walletpubkey
    // lamports -- amount to stake with
    // lockup -- unlock stake, -- default (0,0,walletpubkey)
    //console.log(stakeAccount);
    //let stakePubkey = new web3.PublicKey(stakeAccount);
    if (!validatoraddress || !stakeAccount || !amount){
      console.log('Error');
      const error = {
        message: "Please fill all fields",
      };
      throw error;
    }
    var stakePubkey = stakeAccount.publicKey;
    let createStakeAccountTransaction = web3.StakeProgram.createAccount({
      fromPubkey: wallet.publicKey,
      authorized: new web3.Authorized(wallet.publicKey, wallet.publicKey),
      lamports: amount*LAMPORTS_PER_SOL,
      lockup: new web3.Lockup(0, 0, wallet.publicKey),
      stakePubkey: stakePubkey
    });
    //await wallet.signTransaction(createStakeAccountTransaction);
    await wallet.signandSendTransaction(createStakeAccountTransaction, [stakeAccount]);
    // console.log(resp);
    // await web3.sendAndConfirmTransaction(connection, createAccountTransaction, [fromPublicKey, stakeAccount]);

    let votePubkey = new web3.PublicKey(validatoraddress);
    let authorizedPubkey = wallet.publicKey;

    let delegateTransaction = web3.StakeProgram.delegate({
      stakePubkey: stakePubkey, // todo: stakeaccount
      authorizedPubkey: authorizedPubkey, //todo: authacc
      votePubkey: votePubkey,
    });
    return await wallet.signandSendTransaction(delegateTransaction, []);
  }

  async function onlydelegatestake(Stakeaccountaddr, amount, validatoraddress) {
    if (!validatoraddress || !Stakeaccountaddr || !amount){
      console.log('Error');
      const error = {
        message: "Please fill all fields",
      };
      throw error;
    }

    var stakePubkey = Stakeaccountaddr;
    let votePubkey = new web3.PublicKey(validatoraddress);
    let authorizedPubkey = wallet.publicKey;

    let delegateTransaction = web3.StakeProgram.delegate({
      stakePubkey: stakePubkey,
      authorizedPubkey: authorizedPubkey,
      votePubkey: votePubkey,
    });
    return await wallet.signandSendTransaction(delegateTransaction, []);
  }

  async function unstake(StakeAccountaddr) {

    // To withdraw our funds, we first have to deactivate the stake
    if (!StakeAccountaddr){
      console.log('Error');
      const error = {
        message: "Please fill all fields",
      };
      throw error;
    }
    let stakePubkey = StakeAccountaddr;
    let authorizedPubkey = wallet.publicKey;
    let deactivateTransaction = web3.StakeProgram.deactivate({
      stakePubkey: stakePubkey,
      authorizedPubkey: authorizedPubkey,
    });
    return await wallet.signandSendTransaction(deactivateTransaction, []);
  }

  async function withdrawstake(StakeAccountaddr, amount, withdrawaddress) {
    // 1. set parameters sign tx and send
// Once deactivated, we can withdraw our funds
    if (!StakeAccountaddr || !withdrawaddress || !amount){
      console.log('Error');
      const error = {
        message: "Please fill all fields",
      };
      throw error;
    }

    let stakePubkey = StakeAccountaddr;
    let authorizedPubkey = wallet.publicKey;
    let toPubkey = new web3.PublicKey(withdrawaddress);
    let withdrawTransaction = web3.StakeProgram.withdraw({
      stakePubkey: stakePubkey,
      authorizedPubkey: authorizedPubkey,
      toPubkey: toPubkey,
      lamports: amount*LAMPORTS_PER_SOL,
    });

    return await wallet.signandSendTransaction(withdrawTransaction, []);
  }


  return (
    <DialogForm open={open} onClose={onClose}>
      <DialogTitle>Stake Manager</DialogTitle>
      <DialogContent>
          <DialogContentText>
            Stake, Delegate, Unstake or withdraw your SOLVIA.
          </DialogContentText>
        {(
          <Tabs
            value={tab}
            textColor="primary"
            indicatorColor="primary"
            className={classes.tabs}
            variant="scrollable"
            scrollButtons="auto"
            onChange={(e, value) => setTab(value)}
          >
            <Tab label="New Stake" value="newstake" />
            <Tab label="Unstake" value="unstake" />
            <Tab label="Withdraw" value="withdraw" />
            <Tab label="Delegate Stake" value="onlydelegatestake" />
          </Tabs>
        )}
        {tab === 'withdraw' ? (
          <React.Fragment>
            <TextField
              required
              label="Stake Account Address"
              fullWidth
              variant="outlined"
              margin="normal"
              value={StakeAccountaddr}
              onChange={(e) => setStakeAccountaddr(e.target.value)}
              autoFocus
              disabled={sending}
            />
            <TextField
              required
              label="Withdraw Address"
              fullWidth
              variant="outlined"
              margin="normal"
              value={withdrawaddress}
              onChange={(e) => setwithdrawaddress(e.target.value)}
              disabled={sending}
            />
            <TextField
              required
              label="Amount"
              fullWidth
              variant="outlined"
              margin="normal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={sending}
            />
          </React.Fragment>
        ) : tab === 'newstake' ? (// todo : display validator addresses and let user select one
          <React.Fragment>
            <div>
              <InputLabel id="label" margin="normal">Select Validator Address </InputLabel>
              <Select
                label={'Select Validator to Stake to'}
                style={{ width: 400 }}
                value={validatoraddress}
                defaultValue={validators[0]}
                onChange={(e) => setvalidatoraddress(e.target.value)}
                labelId="label"
              >
                {validators?.map(val => {
                    return <MenuItem key={val} value={val}>
                      {val}
                    </MenuItem>
                })}
              </Select>
            <Button
            type="default"
            color="primary"
            disabled={sending}
            onClick={() => update_validators()}>
            Refresh List
            </Button>
            </div>
            <div>
              <CopyableDisplay
                required
                value={stakeAccount.publicKey || ''}
                label={'Stake Account'}
                helperText={'Please note your Stake Account for future use.'}
              />
              <Button
                type="default"
                color="primary"
                size="small"
                margin="dense"
                disabled={sending}
                onClick={() => newStakeAccount()}
              >
                Generate New
              </Button>
            </div>
            <TextField
              required
              label="Amount"
              fullWidth
              variant="outlined"
              margin="normal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={sending}
            />
          </React.Fragment>
        ) : tab === 'unstake' ? (
          <>
            <TextField
              required
              label="Stake Account Address"
              fullWidth
              variant="outlined"
              margin="normal"
              value={StakeAccountaddr}
              onChange={(e) => setStakeAccountaddr(e.target.value)}
              autoFocus
              disabled={sending}
            />
          </>
        ) : tab === 'onlydelegatestake' ? (
          <React.Fragment>
            <>Warning : Only for Advanced Users</>
            <TextField
              required
              label="Stake Account Address"
              fullWidth
              variant="outlined"
              margin="normal"
              value={StakeAccountaddr}
              onChange={(e) => setStakeAccountaddr(e.target.value)}
              autoFocus
              disabled={sending}
            />
            <div>
              <InputLabel id="label" margin="normal">Select Validator Address </InputLabel>
              <Select
                label={'Select Validator to Stake to'}
                style={{ width: 400 }}
                value={validatoraddress}
                defaultValue={validators[0]}
                onChange={(e) => setvalidatoraddress(e.target.value)}
                labelId="label"
              >
                {validators?.map(val => {
                  return <MenuItem key={val} value={val}>
                    {val}
                  </MenuItem>
                })}
              </Select>
              <Button
                type="default"
                color="primary"
                disabled={sending}
                onClick={() => update_validators()}>
                Refresh List
              </Button>
            </div>
            <TextField
              required
              label="Amount"
              fullWidth
              variant="outlined"
              margin="normal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={sending}
            />
          </React.Fragment>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {<Button
            type="submit"
            color="primary"
            disabled={sending}
            onClick={() => onSubmit({ stakeAccount, validatoraddress, withdrawaddress, amount, StakeAccountaddr })}
          >
          Submit
          </Button>
        }
      </DialogActions>
    </DialogForm>
  );
}

function TokenListItem({ tokenInfo, onSubmit, disabled, existingAccount }) {
  const [open, setOpen] = useState(false);
  const urlSuffix = useSolanaExplorerUrlSuffix();
  const alreadyExists = !!existingAccount;

  return (
    <React.Fragment>
      <div style={{ display: 'flex' }} key={tokenInfo.name}>
        <ListItem button onClick={() => setOpen((open) => !open)}>
          <ListItemIcon>
            <TokenIcon
              url={tokenInfo.logoUri}
              tokenName={tokenInfo.name}
              size={20}
            />
          </ListItemIcon>
          <ListItemText
            primary={
              <Link
                target="_blank"
                rel="noopener"
                href={
                  `https://explorer.solvia.io/account/${tokenInfo.address}` +
                  urlSuffix
                }
              >
                {tokenInfo.name ?? abbreviateAddress(tokenInfo.address)}
                {tokenInfo.symbol ? ` (${tokenInfo.symbol})` : null}
              </Link>
            }
          />
          {open ? <ExpandLess /> : <ExpandMore />}
        </ListItem>
        <Button
          type="submit"
          color="primary"
          disabled={disabled || alreadyExists}
          onClick={() =>
            onSubmit({
              tokenName: tokenInfo.name,
              tokenSymbol: tokenInfo.symbol,
              mintAddress: tokenInfo.address,
            })
          }
        >
          {alreadyExists ? 'Added' : 'Add'}
        </Button>
      </div>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <CopyableDisplay
          value={tokenInfo.address}
          label={`${tokenInfo.symbol} Mint Address`}
        />
      </Collapse>
    </React.Fragment>
  );
}
