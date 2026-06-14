import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  projects: [],
  selectedProject: null
}

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setProjects: (state, action) => {
      state.projects = action.payload
    },
    setSelectedProject: (state, action) => {
      state.selectedProject = action.payload
    }
  }
})

export const { setProjects, setSelectedProject } = projectsSlice.actions
export default projectsSlice.reducer
