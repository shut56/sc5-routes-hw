import React from 'react'
import Head from './head'

const Dummy = () => (
  <div>
    <Head title="Hello" />
    <div className="h-100 w-full flex items-center justify-center bg-teal-lightest font-sans">
      <div className="bg-white rounded shadow p-6 m-4 w-full lg:w-3/4 lg:max-w-lg">
        <div className="flex justify-center items-center mb-4">
          <h1 className="text-grey-darkest">Express Routes</h1>
        </div>
      </div>
    </div>
  </div>
)

Dummy.propTypes = {}

export default React.memo(Dummy)
