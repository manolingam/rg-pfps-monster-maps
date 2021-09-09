import { Address, BigInt, log } from '@graphprotocol/graph-ts';
import {
  Transfer,
  MonsterMaps as MonsterMapsContract
} from '../generated/MonsterMaps/MonsterMaps';
import { MonsterSpawn as MonsterSpawnContract } from '../generated/MonsterSpawn/MonsterSpawn';
import { MonsterBook as MonsterBookContract } from '../generated/MonsterSpawn/MonsterBook';

import {
  Map,
  Monster,
  MonsterBook,
  Owner,
  MapMint,
  MapTrade,
  MonsterMint,
  MonsterTrade
} from '../generated/schema';

const zeroAddress = '0x0000000000000000000000000000000000000000';

function writeMonsterBook(_monsterId: BigInt): string {
  let monsterId = _monsterId;

  let monsterBook = new MonsterBook(monsterId.toHex());

  let monsterBookContract = MonsterBookContract.bind(
    Address.fromString('0x1B7c86617636856F3c95868490d23678a7445dfD')
  );

  let name = monsterBookContract.getName(monsterId);
  let size = monsterBookContract.getSize(monsterId);
  let weakness = monsterBookContract.getWeakness(monsterId);
  let specialAbility = monsterBookContract.getSpecialAbility(monsterId);
  let locomotion = monsterBookContract.getLocomotion(monsterId);
  let language = monsterBookContract.getLanguage(monsterId);
  let alignment = monsterBookContract.getAlignment(monsterId);
  let action1 = monsterBookContract.getAction1(monsterId);
  let action2 = monsterBookContract.getAction2(monsterId);

  monsterBook.name = name;
  monsterBook.size = size;
  monsterBook.weakness = weakness;
  monsterBook.specialAbility = specialAbility;
  monsterBook.locomotion = locomotion;
  monsterBook.language = language;
  monsterBook.alignment = alignment;
  monsterBook.action1 = action1;
  monsterBook.action2 = action2;

  monsterBook.save();

  return monsterBook.id;
}

function handleMonsterClaim(event: Transfer): void {
  let monsterMint = new MonsterMint(event.transaction.hash.toHex());
  let monsterMinter = Owner.load(event.params.to.toHex());
  let monster = Monster.load(event.params.tokenId.toHex());

  // if no monster already present in the id
  if (monster == null) {
    monster = new Monster(event.params.tokenId.toHex());
    monster.tokenId = event.params.tokenId;
    monster.monsterInfo = writeMonsterBook(event.params.tokenId);
  }

  // if no owner already present in the id
  if (monsterMinter == null) {
    monsterMinter = new Owner(event.params.to.toHex());
    monsterMinter.address = event.params.to;
  }

  let monsterSpawnContract = MonsterSpawnContract.bind(event.address);
  let mintedTokenUri = monsterSpawnContract.tokenURI(event.params.tokenId);

  monsterMint.minter = monsterMinter.id;
  monsterMint.time = event.block.timestamp;

  monster.owner = monsterMinter.id;
  monster.tokenUri = mintedTokenUri;
  monster.mintInfo = monsterMint.id;

  monsterMint.save();
  monsterMinter.save();
  monster.save();
}

function handleMonsterOwnerChange(event: Transfer): void {
  let trade = new MonsterTrade(event.transaction.hash.toHex());
  let monster = Monster.load(event.params.tokenId.toHex());
  let oldOwner = Owner.load(event.params.from.toHex());
  let newOwner = Owner.load(event.params.to.toHex());

  if (newOwner == null) {
    newOwner = new Owner(event.params.to.toHex());
    newOwner.address = event.params.to;
  }

  if (monster == null) {
    monster = new Monster(event.params.tokenId.toHex());
  }

  trade.oldOwner = oldOwner.id;
  trade.newOwner = newOwner.id;
  trade.time = event.block.timestamp;

  monster.owner = newOwner.id;
  monster.tradeInfo = trade.id;

  newOwner.save();
  oldOwner.save();
  monster.save();
  trade.save();
}

function handleMapClaim(event: Transfer): void {
  let mapMint = new MapMint(event.transaction.hash.toHex());
  let map = new Map(event.params.tokenId.toHex());

  let mapMinter = Owner.load(event.params.to.toHex());

  if (mapMinter == null) {
    mapMinter = new Owner(event.params.to.toHex());
    mapMinter.address = event.params.to;
  }

  let monsterMapsContract = MonsterMapsContract.bind(event.address);
  let monstersFound = monsterMapsContract.getMonsterIds(event.params.tokenId);

  let monsterSpawnContract = MonsterSpawnContract.bind(
    Address.fromString('0xeCb9B2EA457740fBDe58c758E4C574834224413e')
  );

  let monsters: string[];

  for (let i = 0; i < monstersFound.length; i++) {
    let monster = Monster.load(monstersFound[i].toHex());

    if (monster == null) {
      monster = new Monster(monstersFound[i].toHex());
      monster.tokenId = monstersFound[i];
      monster.monsterInfo = writeMonsterBook(monstersFound[i]);
    }

    if (!monsterSpawnContract.try_ownerOf(monstersFound[i]).reverted) {
      let monsterOwnerAddress = monsterSpawnContract.ownerOf(monstersFound[i]);
      let monsterOwner = Owner.load(monsterOwnerAddress.toHex());

      if (monsterOwner == null) {
        monsterOwner = new Owner(monsterOwnerAddress.toString());
        monsterOwner.address = monsterOwnerAddress;
        monsterOwner.save();
      }
    }

    if (!monsterSpawnContract.try_tokenURI(monstersFound[i]).reverted) {
      let monsterTokenUri = monsterSpawnContract.tokenURI(monstersFound[i]);
      monster.tokenUri = monsterTokenUri;
    } else {
      monster.tokenUri = '';
    }

    monster.save();
    monsters.push(monster.id);
  }

  mapMint.minter = mapMinter.id;
  mapMint.time = event.block.timestamp;

  map.tokenId = event.params.tokenId;
  map.tokenUri = monsterMapsContract.tokenURI(event.params.tokenId);
  map.owner = mapMinter.id;
  map.mintInfo = mapMint.id;
  map.monsters = monsters;

  mapMint.save();
  mapMinter.save();
  map.save();
}

function handleMapOwnerChange(event: Transfer): void {
  let trade = new MapTrade(event.transaction.hash.toHex());
  let map = Map.load(event.params.tokenId.toHex());
  let oldOwner = Owner.load(event.params.from.toHex());
  let newOwner = Owner.load(event.params.to.toHex());

  if (newOwner == null) {
    newOwner = new Owner(event.params.to.toHex());
    newOwner.address = event.params.to;
  }

  if (map == null) {
    map = new Map(event.params.tokenId.toHex());
  }

  trade.oldOwner = oldOwner.id;
  trade.newOwner = newOwner.id;
  trade.time = event.block.timestamp;

  map.owner = newOwner.id;
  map.tradeInfo = trade.id;

  newOwner.save();
  oldOwner.save();
  trade.save();
  map.save();
}

export function handleMonsterTransfer(event: Transfer): void {
  let from = event.params.from.toHex();
  let to = event.params.to.toHex();

  if (from == zeroAddress && to != zeroAddress) {
    handleMonsterClaim(event);
  } else if (from != zeroAddress && to != zeroAddress) {
    handleMonsterOwnerChange(event);
  }
}

export function handleMapTransfer(event: Transfer): void {
  let from = event.params.from.toHex();
  let to = event.params.to.toHex();

  if (from == zeroAddress && to != zeroAddress) {
    handleMapClaim(event);
  } else if (from != zeroAddress && to != zeroAddress) {
    handleMapOwnerChange(event);
  }
}
