const { assert, expect } = require("chai")
const { ethers, deployments } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("NftMarketplace Unit Tests", () => {
          let deployer
          let nftMarketplace
          let shibaInuNft

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
              // Mint shibaInuNft
              await shibaInuNft.mintNft()
              // Approve Marketplace to sell for Owner
              await shibaInuNft.approve(nftMarketplace.address, TOKEN_ID)
          })

          describe("listItem", () => {
              it("Reverts if price is not above zero", async () => {
                  await expect(
                      nftMarketplace.listItem(shibaInuNft.address, TOKEN_ID, "0")
                  ).to.be.revertedWithCustomError(
                      nftMarketplace,
                      "NftMarketplace__PriceMustBeAboveZero"
                  )
              })
          })
      })
