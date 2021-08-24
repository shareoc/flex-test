import { updatedEntities, denormalisedEntities } from '../../util/data';
import { storableError } from '../../util/errors';
import { types as sdkTypes } from '../../util/sdkLoader';

import { parse } from '../../util/urlHelpers';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { queryListingsSuccess } from '../ManageListingsPage/ManageListingsPage.duck';

const { UUID } = sdkTypes;

// Pagination page size might need to be dynamic on responsive page layouts
// Current design has max 3 columns 42 is divisible by 2 and 3
// So, there's enough cards to fill all columns on full pagination pages
const RESULT_PAGE_SIZE = 42;

// ================ Action types ================ //

export const FETCH_WISHLIST_REQUEST = 'app/ViewWishlistPage/FETCH_WISHLIST_REQUEST';
export const FETCH_WISHLIST_SUCCESS = 'app/ViewWishlistPage/FETCH_WISHLIST_SUCCESS';
export const FETCH_WISHLIST_ERROR = 'app/ViewWishlistPage/FETCH_WISHLIST_ERROR';

export const FETCH_LISTINGS_REQUEST = 'app/ViewWishlistPage/FETCH_LISTINGS_REQUEST';
export const FETCH_LISTINGS_SUCCESS = 'app/ViewWishlistPage/FETCH_LISTINGS_SUCCESS';
export const FETCH_LISTINGS_ERROR = 'app/ViewWishlistPage/FETCH_LISTINGS_ERROR';

// ================ Reducer ================ //

const initialState = {
  pagination: null, // is pagination going to be used
  queryParams: null, // query parameters for api request that fetches listings
  queryInProgress: false, // byt default query is not in progress
  queryListingsError: null, // by default no error
  wishlist: [], // empty array to initialise array i guess
  ownEntities: {}, // current users listings?
  openingListing: null, // not sure about the rest
  openingListingError: null,
  closingListing: null,
  closingListingError: null,
};

const resultIds = data => data.data.map(l => l.id); // function that maps id's from listing objects

const merge = (state, sdkResponse) => {
  const apiResponse = sdkResponse.data;
  return {
    ...state,
    ownEntities: updatedEntities({ ...state.ownEntities }, apiResponse),
  };
};

const updateListingAttributes = (state, listingEntity) => {
  const oldListing = state.ownEntities.ownListing[listingEntity.id.uuid];
  const updatedListing = { ...oldListing, attributes: listingEntity.attributes };
  const ownListingEntities = {
    ...state.ownEntities.ownListing,
    [listingEntity.id.uuid]: updatedListing,
  };
  return {
    ...state,
    ownEntities: { ...state.ownEntities, ownListing: ownListingEntities },
  };
};

const manageListingsPageReducer = (state = initialState, action = {}) => {
  const { type, payload } = action;
  switch (type) {
    case FETCH_LISTINGS_REQUEST:
      return {
        ...state,
        queryParams: payload.queryParams,
        queryInProgress: true,
        queryListingsError: null,
      };
    case FETCH_LISTINGS_SUCCESS:
      return {
        ...state,
        pagination: payload.data.meta,
        queryInProgress: false,
      };
    case FETCH_LISTINGS_ERROR:
      // eslint-disable-next-line no-console
      console.error(payload);
      return { ...state, queryInProgress: false, queryListingsError: payload };

    case FETCH_WISHLIST_REQUEST:
      return {
        ...state,
        queryInProgress: true,
        queryListingsError: null,
        wishlist: [],
      };
    case FETCH_WISHLIST_SUCCESS:
      return {
        ...state,
        wishlist: payload,
        queryInProgress: false,
      };
    case FETCH_WISHLIST_ERROR:
      // eslint-disable-next-line no-console
      console.error(payload);
      return { ...state, queryInProgress: false, queryListingsError: payload };

    default:
      return state;
  }
};

export default manageListingsPageReducer;

// ================ Selectors ================ //

/**
 * Get the denormalised own listing entities with the given IDs
 *
 * @param {Object} state the full Redux store
 * @param {Array<UUID>} listingIds listing IDs to select from the store
 */
export const getOwnListingsById = (state, listingIds) => {
  const resources = listingIds.map(id => ({
    id,
    type: 'listings',
  }));
  const throwIfNotFound = false;
  console.log(resources);
  return denormalisedEntities(listingIds, resources, throwIfNotFound);
};

// ================ Action creators ================ //

// This works the same way as addMarketplaceEntities,
// but we don't want to mix own listings with searched listings
// (own listings data contains different info - e.g. exact location etc.)

export const queryWishlistRequest = queryParams => ({
  type: FETCH_WISHLIST_REQUEST,
  payload: { queryParams },
});

export const queryWishlistSuccess = response => ({
  type: FETCH_WISHLIST_SUCCESS,
  payload: response.map(id => new UUID(id)),
});

export const queryWishlistError = e => ({
  type: FETCH_WISHLIST_ERROR,
  error: true,
  payload: e,
});

export const queryListingsRequest = queryParams => ({
  type: FETCH_LISTINGS_REQUEST,
  payload: { queryParams },
});

export const queryListings = wishlist => (dispatch, getState, sdk) => {
  dispatch(queryListingsRequest());
  // const wishlist = getState().ViewWishlistPage.currentPageResultIds;
  return sdk.listings
    .query({
      pub_id: wishlist,
      include: ['author', 'images'],
      'fields.image': ['variants.landscape-crop', 'variants.landscape-crop2x'],
    })
    .then(response => {
      dispatch(addMarketplaceEntities(response));
      dispatch(queryListingsSuccess(response));
      return response;
    })
    .catch(e => {
      dispatch(queryListingsError(storableError(e)));
      throw e;
    });
};

// Throwing error for new (loadData may need that info)
// This calls current user data
export const queryOwnWishlist = queryParams => (dispatch, getState, sdk) => {
  dispatch(queryWishlistRequest(queryParams));

  const { perPage, ...rest } = queryParams;
  const params = { ...rest, per_page: perPage };
  let wishlist = [];

  return sdk.currentUser
    .show()
    .then(response => {
      wishlist = response.data.data.attributes.profile.privateData.wishlist;
      return dispatch(queryListings(wishlist));
    })
    .then(response => {
      dispatch(queryWishlistSuccess(wishlist));
    })
    .catch(e => {
      dispatch(queryWishlistError(storableError(e)));
      throw e;
    });
};

// so this is what gets the data from the api
export const loadData = (params, search) => {
  const queryParams = parse(search); // pareses a url search query
  const page = queryParams.page || 1;
  return queryOwnWishlist({
    ...queryParams,
    page,
    perPage: RESULT_PAGE_SIZE,
    include: ['images'],
    'fields.image': ['variants.landscape-crop', 'variants.landscape-crop2x'],
    'limit.images': 1,
  });
};
