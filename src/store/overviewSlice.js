import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  overview: null
}

const overviewSlice = createSlice({
  name: 'overview',
  initialState,
  reducers: {
    setOverview: (state, action) => {
      state.overview = action.payload
    },
    clearOverview: (state) => {
      state.overview = null
    }
  }
})

export const { setOverview, clearOverview } = overviewSlice.actions
export default overviewSlice.reducer
