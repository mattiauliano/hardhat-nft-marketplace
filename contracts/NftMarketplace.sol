// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
// Use a mutex to avoid reentrancy attacks
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error NftMarketplace__PriceMustBeAboveZero();
error NftMarketplace__NotApprovedForMarketplace();
error NftMarketplace__AlreadyListed(address nftAddress, uint256 tokenId);
error NftMarketplace__NotOwner();
error NftMarketplace__NotListed(address nftAddress, uint256 tokenId);
error NftMarketplace__PriceNotMet(address nftAddress, uint256 tokenId, uint256 price);
error nftMarketplace__TransferFail();
error NftMarketplace__NoProceeds();

contract NftMarketplace is ReentrancyGuard {
    struct Listing {
        uint256 price;
        address seller;
    }
    // NFT Contract Address => TokenID => Price, Seller
    mapping(address => mapping(uint256 => Listing)) private s_listings;
    // Seller => Amount
    mapping(address => uint256) private s_proceeds;

    /* Events */
    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );
    event ItemBought(
        address indexed buyer,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );
    event ItemRemoved(address indexed nftAddress, uint256 indexed tokenId, address indexed owner);

    /* Modifiers */
    modifier notListed(
        address nftAddress,
        uint256 tokenId,
        address owner
    ) {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.price > 0) {
            revert NftMarketplace__AlreadyListed(nftAddress, tokenId);
        }
        _;
    }

    modifier isListed(address nftAddress, uint256 tokenId) {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.price <= 0) {
            revert NftMarketplace__NotListed(nftAddress, tokenId);
        }
        _;
    }

    modifier isOwner(
        address nftAddress,
        uint256 tokenId,
        address spender
    ) {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        if (spender != owner) {
            revert NftMarketplace__NotOwner();
        }
        _;
    }

    /* Main Functions */
    function listItem(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    ) external notListed(nftAddress, tokenId, msg.sender) isOwner(nftAddress, tokenId, msg.sender) {
        if (price <= 0) {
            revert NftMarketplace__PriceMustBeAboveZero();
        }

        // Using IERC721 methods
        IERC721 nft = IERC721(nftAddress);
        // Give the marketplace approval to sell the NFT for Owners
        if (nft.getApproved(tokenId) != address(this)) {
            revert NftMarketplace__NotApprovedForMarketplace();
        }

        s_listings[nftAddress][tokenId] = Listing(price, msg.sender);
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }

    function buyItem(
        address nftAddress,
        uint256 tokenId
    ) external payable nonReentrant isListed(nftAddress, tokenId) {
        Listing memory listedItem = s_listings[nftAddress][tokenId];
        if (msg.value < listedItem.price) {
            revert NftMarketplace__PriceNotMet(nftAddress, tokenId, listedItem.price);
        }
        // Add amount to seller
        s_proceeds[listedItem.seller] += msg.value;
        // Remove from listing
        delete s_listings[nftAddress][tokenId];
        // Transfer nft
        IERC721 nft = IERC721(nftAddress);
        nft.safeTransferFrom(listedItem.seller, msg.sender, tokenId);
        // Emit the event
        emit ItemBought(msg.sender, nftAddress, tokenId, listedItem.price);
    }

    function cancelItem(
        address nftAddress,
        uint256 tokenId
    ) external isListed(nftAddress, tokenId) isOwner(nftAddress, tokenId, msg.sender) {
        delete (s_listings[nftAddress][tokenId]);
        emit ItemRemoved(nftAddress, tokenId, msg.sender);
    }

    function updateListing(
        address nftAddress,
        uint256 tokenId,
        uint256 updatedPrice
    ) external isListed(nftAddress, tokenId) isOwner(nftAddress, tokenId, msg.sender) {
        s_listings[nftAddress][tokenId].price = updatedPrice;
        emit ItemListed(msg.sender, nftAddress, tokenId, updatedPrice);
    }

    function withdrawProceeds() external nonReentrant {
        uint256 proceeds = s_proceeds[msg.sender];
        if (proceeds <= 0) {
            revert NftMarketplace__NoProceeds();
        }
        s_proceeds[msg.sender] = 0;
        (bool callSuccess, ) = payable(msg.sender).call{value: proceeds}("");
        if (!callSuccess) {
            revert nftMarketplace__TransferFail();
        }
    }

    /* Getter Fucntions */
    function getListing(
        address nftAddress,
        uint256 tokenId
    ) external view returns (Listing memory) {
        return s_listings[nftAddress][tokenId];
    }

    function getProceeds(address seller) external view returns (uint256) {
        return s_proceeds[seller];
    }
}
