const { assert, expect } = require("chai")
const { ethers, deployments } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("NftMarketplace Unit Tests", () => {
          let deployer
          let nftMarketplace
          let shibaInuNft
          let pugNft

          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 0

          beforeEach(async () => {
              const accounts = await ethers.getSigners()
              deployer = accounts[0]
              user = accounts[1]
              // Get contracts
              await deployments.fixture(["all"])
              nftMarketplace = await ethers.getContract("NftMarketplace", deployer)
              shibaInuNft = await ethers.getContract("ShibaInuNft", deployer)
              pugNft = await ethers.getContract("PugNft", deployer)
              // Mint
              await shibaInuNft.mintNft()
              await pugNft.mintNft()
          })

          describe("listItem", () => {
              it("Reverts if price is not above zero", async () => {
                  // Approve Marketplace to sell for Owner
                  await shibaInuNft.approve(nftMarketplace.address, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(shibaInuNft.address, TOKEN_ID, "0")
                  ).to.be.revertedWithCustomError(
                      nftMarketplace,
                      "NftMarketplace__PriceMustBeAboveZero"
                  )
              })

              it("Reverts if the marketplace is not approved", async () => {
                  await expect(
                      nftMarketplace.listItem(shibaInuNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWithCustomError(
                      nftMarketplace,
                      "NftMarketplace__NotApprovedForMarketplace"
                  )
              })

              it("Reverts if the nft is already listed", async () => {
                  await shibaInuNft.approve(nftMarketplace.address, TOKEN_ID)
                  await nftMarketplace.listItem(shibaInuNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.listItem(shibaInuNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__AlreadyListed")
              })

              it("Should list the nft", async () => {
                  await shibaInuNft.approve(nftMarketplace.address, TOKEN_ID)
                  await nftMarketplace.listItem(shibaInuNft.address, TOKEN_ID, PRICE)
                  const listedItem = await nftMarketplace.getListing(shibaInuNft.address, TOKEN_ID)
                  // Price
                  const listedPrice = listedItem.price
                  // Seller
                  const listedSeller = listedItem.seller
                  assert.equal(listedPrice.toString(), PRICE.toString())
                  assert.equal(listedSeller, deployer.address)
              })

              it("Emits ItemListed event", async () => {
                  await shibaInuNft.approve(nftMarketplace.address, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(shibaInuNft.address, TOKEN_ID, PRICE)
                  ).to.emit(nftMarketplace, "ItemListed")
              })
          })

          describe("buyItem", () => {
              let connectedUser

              beforeEach(async () => {
                  await shibaInuNft.approve(nftMarketplace.address, TOKEN_ID)
                  await nftMarketplace.listItem(shibaInuNft.address, TOKEN_ID, PRICE)
                  connectedUser = nftMarketplace.connect(user)
              })

              it("Reverts if the item is not listed", async () => {
                  await expect(connectedUser.buyItem(pugNft.address, 1)).to.revertedWithCustomError(
                      nftMarketplace,
                      "NftMarketplace__NotListed"
                  )
              })

              it("Reverts if the buyer doesn't send the price amount", async () => {
                  await expect(
                      nftMarketplace.buyItem(shibaInuNft.address, TOKEN_ID)
                  ).to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__PriceNotMet")
              })

              it("Updates the proceeds of the seller and transfers the nft to the buyer", async () => {
                  const initialProceeds = await nftMarketplace.getProceeds(deployer.address)
                  await expect(
                      connectedUser.buyItem(shibaInuNft.address, TOKEN_ID, { value: PRICE })
                  ).to.emit(nftMarketplace, "ItemBought")
                  const newOwner = await shibaInuNft.ownerOf(TOKEN_ID)
                  const finalProceeds = await nftMarketplace.getProceeds(deployer.address)

                  assert.equal(newOwner, user.address)
                  assert.equal(initialProceeds.add(finalProceeds).toString(), PRICE.toString())
              })

              it("Deletes bought item from the list", async () => {
                  await connectedUser.buyItem(shibaInuNft.address, TOKEN_ID, { value: PRICE })
                  await expect(
                      connectedUser.buyItem(shibaInuNft.address, TOKEN_ID, { value: PRICE })
                  ).to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NotListed")
              })
          })

          describe("cancelItem", () => {
              beforeEach(async () => {
                  await shibaInuNft.approve(nftMarketplace.address, TOKEN_ID)
                  await nftMarketplace.listItem(shibaInuNft.address, TOKEN_ID, PRICE)
              })

              it("Removes from the list on owner's choice", async () => {
                  await expect(nftMarketplace.cancelItem(shibaInuNft.address, TOKEN_ID)).to.be.emit(
                      nftMarketplace,
                      "ItemRemoved"
                  )
                  const connectedUser = nftMarketplace.connect(user)
                  await expect(
                      connectedUser.buyItem(shibaInuNft.address, TOKEN_ID, { value: PRICE })
                  ).to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NotListed")
              })

              it("The owner only should be able to remove his nft", async () => {
                  const connectedUser = nftMarketplace.connect(user)
                  await expect(
                      connectedUser.cancelItem(shibaInuNft.address, TOKEN_ID)
                  ).to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NotOwner")
              })
          })

          describe("updateListing", () => {
              beforeEach(async () => {
                  await shibaInuNft.approve(nftMarketplace.address, TOKEN_ID)
              })
              it("Must be owner and listed", async () => {
                  await expect(
                      nftMarketplace.updateListing(shibaInuNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NotListed")
                  await nftMarketplace.listItem(shibaInuNft.address, TOKEN_ID, PRICE)
                  const connectedUser = nftMarketplace.connect(user)
                  await expect(
                      connectedUser.updateListing(shibaInuNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NotOwner")
              })

              it("updates the price of the item", async function () {
                  const updatedPrice = ethers.utils.parseEther("0.2")
                  await nftMarketplace.listItem(shibaInuNft.address, TOKEN_ID, PRICE)
                  expect(
                      await nftMarketplace.updateListing(
                          shibaInuNft.address,
                          TOKEN_ID,
                          updatedPrice
                      )
                  ).to.emit(nftMarketplace, "ItemListed")
                  const listing = await nftMarketplace.getListing(shibaInuNft.address, TOKEN_ID)
                  assert.equal(listing.price.toString(), updatedPrice.toString())
              })
          })

          describe("withdrawProceeds", () => {
              beforeEach(async () => {
                  await shibaInuNft.approve(nftMarketplace.address, TOKEN_ID)
              })

              it("Doesn't allow 0 proceed withdraws", async () => {
                  await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWithCustomError(
                      nftMarketplace,
                      "NftMarketplace__NoProceeds"
                  )
              })

              it("withdraws proceeds", async () => {
                  await nftMarketplace.listItem(shibaInuNft.address, TOKEN_ID, PRICE)
                  const connectedUser = nftMarketplace.connect(user)
                  await connectedUser.buyItem(shibaInuNft.address, TOKEN_ID, { value: PRICE })

                  const initialProceeds = await nftMarketplace.getProceeds(deployer.address)
                  const initialBalance = await deployer.getBalance()

                  const tx = await nftMarketplace.withdrawProceeds()
                  const txReceipt = await tx.wait(1)
                  // Get the used gas
                  const { gasUsed, effectiveGasPrice } = txReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  const finalBalance = await deployer.getBalance()

                  assert.equal(
                      finalBalance.add(gasCost).toString(),
                      initialProceeds.add(initialBalance).toString()
                  )
              })
          })
      })
