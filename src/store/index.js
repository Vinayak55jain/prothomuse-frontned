import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import projectsReducer from './projectsSlice'
import overviewReducer from './overviewSlice'

const store = configureStore({
  reducer: {
    auth: authReducer,
    projects: projectsReducer,
    overview: overviewReducer
  }
})

export default store
